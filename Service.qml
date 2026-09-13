pragma ComponentBehavior: Bound
import QtQuick
import Quickshell
import Quickshell.Io
import "js/storage.js" as Storage
import "js/metronome.js" as Metronome
import "js/tempo_trainer.js" as Trainer
import "js/stage_engine.js" as StageEngine
import "js/pitch.js" as Pitch
import "js/tunings.js" as Tunings
import "js/theory.js" as Theory
import "js/fretboard.js" as Fretboard
import "js/visual_shapes.js" as VisualShapes
import "js/chord_voicings.js" as Voicings
import "js/routines.js" as Routines
import "js/progress.js" as Progress
import "js/exercises.js" as Exercises
import "js/presets.js" as Presets
import "js/jam_sessions.js" as JamSessions

Item {
    id: service

    property var shell: null
    property var manifest: null

    function localPath(relative) {
        return decodeURIComponent(Qt.resolvedUrl(relative).toString().replace(/^file:\/\//, ""))
    }

    // ------------------------------------------------------------ persistence
    readonly property string stateHome: {
        var configured = Quickshell.env("XDG_STATE_HOME")
        return configured && configured !== "" ? configured : Quickshell.env("HOME") + "/.local/state"
    }
    readonly property string statePath: stateHome + "/omarchy/fretboard/state.json"

    property var preferences: Storage.decode("").value.preferences
    property var customTunings: []
    property var routines: []
    property var exercises: []
    property var songs: []
    property var sessions: []
    property var exerciseProgress: ({})
    property bool hydrated: false
    property bool writeDirty: false
    property string writePayload: ""
    property string lastError: ""

    function stateObject() {
        return {
            schemaVersion: 1,
            preferences: preferences,
            customTunings: customTunings,
            routines: routines,
            exercises: exercises,
            songs: songs,
            sessions: sessions,
            exerciseProgress: exerciseProgress
        }
    }

    function requestSave() {
        writeDirty = true
        if (!stateWriter.running) startWrite()
    }

    function startWrite() {
        if (!writeDirty || stateWriter.running) return
        writeDirty = false
        writePayload = Storage.encode(stateObject())
        stateWriter.command = ["bash", "-c",
            "set -eu\npath=$1\npayload=$2\ndir=${path%/*}\nmkdir -p -- \"$dir\"\ntmp=$(mktemp \"$dir/.state.XXXXXX\")\ntrap 'rm -f -- \"$tmp\"' EXIT\numask 077\nprintf '%s' \"$payload\" > \"$tmp\"\nchmod 600 \"$tmp\"\nmv -f -- \"$tmp\" \"$path\"\ntrap - EXIT",
            "fretboard-state", statePath, writePayload]
        stateWriter.running = true
    }

    function restore(raw) {
        if (hydrated) return
        var result = Storage.decode(raw)
        if (!result.ok) lastError = result.error || "State file could not be read"
        var value = result.value
        preferences = value.preferences
        customTunings = value.customTunings
        routines = value.routines
        exercises = value.exercises
        songs = value.songs
        sessions = value.sessions
        exerciseProgress = value.exerciseProgress
        selectedTuningId = preferences.defaultTuningId
        timeSignatureId = preferences.lastTimeSignatureId
        subdivisionId = preferences.lastSubdivisionId
        metronomeVolume = preferences.metronomeVolume
        tunerInputDevice = preferences.tunerInputDevice
        hydrated = true
        if (result.migrated) requestSave()
    }

    FileView {
        id: stateFile
        path: service.statePath
        preload: true
        printErrors: false
        onLoaded: service.restore(stateFile.text())
        onLoadFailed: function (error) { service.restore("") }
    }

    Process {
        id: stateWriter
        running: false
        command: []
        stderr: StdioCollector { id: writerError; waitForEnd: true }
        onExited: function (code) {
            service.lastError = code !== 0 ? ("Could not save Fretboard data: " + String(writerError.text || "write failed")) : ""
            if (service.writeDirty) service.startWrite()
        }
    }

    // ------------------------------------------------------------ audio engine (metronome + drone)
    readonly property string audioHelperPath: localPath("helper/audio_engine.py")
    property bool audioAvailable: true
    property bool metronomeRunning: false
    property int metronomeBpm: 120
    property string timeSignatureId: "4-4"
    property string subdivisionId: "quarter"
    property real metronomeVolume: 0.8
    property var tapTimes: []
    property var lastBeat: null

    property bool droneRunning: false
    property string droneNote: "E"
    property int droneOctave: 2

    Process {
        id: audioProcess
        command: [service.pythonBin, service.audioHelperPath]
        running: false
        stdinEnabled: true
        stdout: SplitParser {
            onRead: function (line) { service.handleAudioLine(line) }
        }
    }

    readonly property string pythonBin: "python3"

    function ensureAudioProcess() {
        if (!audioProcess.running) audioProcess.running = true
    }

    function sendAudio(cmd) {
        ensureAudioProcess()
        audioProcess.write(JSON.stringify(cmd) + "\n")
    }

    function handleAudioLine(line) {
        var msg
        try { msg = JSON.parse(line) } catch (error) { return }
        if (msg.type === "beat") {
            lastBeat = msg
            if (tempoTrainerActive && tempoTrainerPlan.incrementMode === "bars" && msg.beatIndex === 0 && msg.subIndex === 0) {
                tempoTrainerBarCount += 1
            }
            if (stageStages && stageRunning && stageAdvance && stageAdvance.mode === "bars" && msg.beatIndex === 0 && msg.subIndex === 0) {
                stageBarCount += 1
            }
            if (jamActive && jamRunning && msg.beatIndex === 0 && msg.subIndex === 0) {
                jamBarCount += 1
            }
        } else if (msg.type === "status") {
            if (msg.mode === "metronome") metronomeRunning = !!msg.running
            else if (msg.mode === "drone") droneRunning = !!msg.running
        } else if (msg.type === "error") {
            audioAvailable = false
            lastError = msg.message
            metronomeRunning = false
            droneRunning = false
        } else if (msg.type === "ready") {
            audioAvailable = msg.playbackAvailable !== false
        }
    }

    function startMetronome() {
        if (droneRunning) stopDrone()
        if (jamActive) stopJam()
        sendAudio({ cmd: "start", mode: "metronome", bpm: metronomeBpm, timeSignatureId: timeSignatureId, subdivisionId: subdivisionId, volume: metronomeVolume })
    }

    function stopMetronome() {
        sendAudio({ cmd: "stop" })
        metronomeRunning = false
    }

    function toggleMetronome() {
        if (metronomeRunning) stopMetronome(); else startMetronome()
    }

    function pushMetronomeUpdate() {
        if (metronomeRunning) sendAudio({ cmd: "update", mode: "metronome", bpm: metronomeBpm, timeSignatureId: timeSignatureId, subdivisionId: subdivisionId, volume: metronomeVolume })
    }

    function setMetronomeBpm(bpm) {
        metronomeBpm = Metronome.clampBpm(bpm)
        pushMetronomeUpdate()
    }

    function adjustMetronomeBpm(delta) {
        setMetronomeBpm(Metronome.adjustBpm(metronomeBpm, delta))
    }

    function setTimeSignature(id) {
        timeSignatureId = id
        preferences = Object.assign({}, preferences, { lastTimeSignatureId: id })
        requestSave()
        pushMetronomeUpdate()
    }

    function setSubdivision(id) {
        subdivisionId = id
        preferences = Object.assign({}, preferences, { lastSubdivisionId: id })
        requestSave()
        pushMetronomeUpdate()
    }

    function setMetronomeVolume(volume) {
        metronomeVolume = Math.max(0, Math.min(1, volume))
        preferences = Object.assign({}, preferences, { metronomeVolume: metronomeVolume })
        requestSave()
        pushMetronomeUpdate()
    }

    function tapTempo() {
        var result = Metronome.recordTap(tapTimes, Date.now())
        tapTimes = result.taps
        if (result.bpm) setMetronomeBpm(result.bpm)
    }

    function frequencyForDrone(note, octave) {
        return Pitch.noteToFrequency(note, octave, preferences.a4)
    }

    function startDrone() {
        if (metronomeRunning) stopMetronome()
        if (tempoTrainerActive) stopTempoTrainer()
        if (jamActive) stopJam()
        sendAudio({ cmd: "start", mode: "drone", frequency: frequencyForDrone(droneNote, droneOctave), volume: metronomeVolume })
    }

    function stopDrone() {
        sendAudio({ cmd: "stop" })
        droneRunning = false
    }

    function setDroneNoteOctave(note, octave) {
        droneNote = note
        droneOctave = octave
        if (droneRunning) sendAudio({ cmd: "update", mode: "drone", frequency: frequencyForDrone(note, octave) })
    }

    // ------------------------------------------------------------ tempo trainer
    property var tempoTrainerPlan: null
    property bool tempoTrainerActive: false
    property bool tempoTrainerRunning: false
    property double tempoTrainerElapsedMs: 0
    property double tempoTrainerResumedAt: 0
    property int tempoTrainerBarCount: 0
    property bool tempoTrainerFinished: false

    function startTempoTrainer(plan) {
        tempoTrainerPlan = plan
        tempoTrainerActive = true
        tempoTrainerRunning = true
        tempoTrainerFinished = false
        tempoTrainerElapsedMs = 0
        tempoTrainerResumedAt = Date.now()
        tempoTrainerBarCount = 0
        setMetronomeBpm(plan.startBpm)
        startMetronome()
    }

    function pauseTempoTrainer() {
        if (!tempoTrainerRunning) return
        tempoTrainerElapsedMs += Date.now() - tempoTrainerResumedAt
        tempoTrainerRunning = false
    }

    function resumeTempoTrainer() {
        if (tempoTrainerRunning || !tempoTrainerActive) return
        tempoTrainerResumedAt = Date.now()
        tempoTrainerRunning = true
    }

    function resetTempoTrainer() {
        if (!tempoTrainerPlan) return
        tempoTrainerElapsedMs = 0
        tempoTrainerBarCount = 0
        tempoTrainerFinished = false
        tempoTrainerResumedAt = Date.now()
        setMetronomeBpm(tempoTrainerPlan.startBpm)
    }

    function stopTempoTrainer() {
        tempoTrainerActive = false
        tempoTrainerRunning = false
        tempoTrainerPlan = null
    }

    function tempoTrainerElapsedSeconds() {
        var extra = tempoTrainerRunning ? (Date.now() - tempoTrainerResumedAt) : 0
        return (tempoTrainerElapsedMs + extra) / 1000
    }

    Timer {
        id: tempoTrainerTicker
        interval: 250
        repeat: true
        running: service.tempoTrainerActive && service.tempoTrainerRunning
        onTriggered: service.evaluateTempoTrainer()
    }

    function evaluateTempoTrainer() {
        if (!tempoTrainerPlan) return
        var next = tempoTrainerPlan.incrementMode === "bars"
            ? Trainer.bpmAtCompletedBars(tempoTrainerPlan, tempoTrainerBarCount)
            : Trainer.bpmAtElapsedSeconds(tempoTrainerPlan, tempoTrainerElapsedSeconds())
        if (next !== metronomeBpm) setMetronomeBpm(next)
        if (!tempoTrainerFinished && Trainer.isComplete(tempoTrainerPlan, next)) {
            tempoTrainerFinished = true
        }
    }

    // ------------------------------------------------------------ dynamic stage engine (v0.4)
    // Drives an optional per-item stage sequence (js/routines.js's
    // hasStages/resolveStageItem, js/stage_engine.js). Generic by design so
    // a v0.5 Jam Session can reuse it for chord-change timing later - this
    // block knows nothing about scales/triads/BPM, only "which index, when".
    property var stageStages: null
    property var stageAdvance: null
    property int stageIndex: 0
    property double stageElapsedMs: 0
    property double stageResumedAt: 0
    property int stageBarCount: 0
    property bool stageRunning: false

    function stageElapsedSeconds() {
        var extra = stageRunning ? (Date.now() - stageResumedAt) : 0
        return (stageElapsedMs + extra) / 1000
    }

    Timer {
        id: stageTicker
        interval: 250
        repeat: true
        running: service.stageStages !== null && service.stageRunning
        onTriggered: service.evaluateStageProgression()
    }

    function evaluateStageProgression() {
        if (!stageStages || !stageStages.length) return
        var next = StageEngine.autoStageIndex(stageStages, stageAdvance, stageElapsedSeconds(), stageBarCount)
        if (next !== stageIndex) setStageIndex(next)
    }

    function setStageIndex(index) {
        stageIndex = StageEngine.clampIndex(stageStages, index)
        var base = activeBaseItem()
        if (base) applyToneAndMetronome(Routines.resolveStageItem(base, stageIndex), true)
    }

    // Manual Previous/Next: rebases the running elapsed-time/bar-count clock
    // so automatic progression continues naturally from the new position
    // instead of immediately overriding it back on the next tick.
    function goToStage(index) {
        if (!stageStages) return
        var clamped = StageEngine.clampIndex(stageStages, index)
        if (stageAdvance && stageAdvance.mode === "bars") {
            stageBarCount = StageEngine.stageStartBars(stageAdvance, clamped)
        } else {
            stageElapsedMs = StageEngine.stageStartElapsedSeconds(stageAdvance, clamped) * 1000
            stageResumedAt = Date.now()
        }
        setStageIndex(clamped)
    }

    function nextStage() { if (stageStages) goToStage(stageIndex + 1) }
    function previousStage() { if (stageStages) goToStage(stageIndex - 1) }

    function pauseStageProgression() {
        if (!stageStages || !stageRunning) return
        stageElapsedMs += Date.now() - stageResumedAt
        stageRunning = false
    }

    function resumeStageProgression() {
        if (!stageStages || stageRunning) return
        stageResumedAt = Date.now()
        stageRunning = true
    }

    // ------------------------------------------------------------ practice timer
    property int practiceTimerTotalSeconds: 0
    property int practiceTimerRemainingSeconds: 0
    property bool practiceTimerRunning: false
    property bool practiceTimerCompleted: false
    property bool practiceTimerLinkMetronome: false

    function startPracticeTimer(totalSeconds, linkMetronome) {
        practiceTimerTotalSeconds = Math.max(1, Math.round(totalSeconds))
        practiceTimerRemainingSeconds = practiceTimerTotalSeconds
        practiceTimerRunning = true
        practiceTimerCompleted = false
        practiceTimerLinkMetronome = !!linkMetronome
        if (practiceTimerLinkMetronome && !metronomeRunning) startMetronome()
    }

    function pausePracticeTimer() {
        practiceTimerRunning = false
        pauseStageProgression()
    }
    function resumePracticeTimer() {
        if (practiceTimerRemainingSeconds > 0) practiceTimerRunning = true
        resumeStageProgression()
    }

    function resetPracticeTimer() {
        practiceTimerRemainingSeconds = practiceTimerTotalSeconds
        practiceTimerRunning = false
        practiceTimerCompleted = false
    }

    Timer {
        id: practiceTimerTicker
        interval: 1000
        repeat: true
        running: service.practiceTimerRunning
        onTriggered: service.tickPracticeTimer()
    }

    function tickPracticeTimer() {
        if (practiceTimerRemainingSeconds <= 0) return
        practiceTimerRemainingSeconds -= 1
        if (practiceTimerRemainingSeconds === 0) {
            practiceTimerRunning = false
            practiceTimerCompleted = true
            if (practiceTimerLinkMetronome && metronomeRunning) stopMetronome()
        }
    }

    // ------------------------------------------------------------ tuner
    readonly property string tunerHelperPath: localPath("helper/tuner_engine.py")
    readonly property string devicesHelperPath: localPath("helper/audio_devices.py")
    property bool tunerListening: false
    property bool tunerAvailable: true
    property var tunerReading: null
    property string tunerInputDevice: ""
    property var tunerDevices: []

    Process {
        id: tunerProcess
        running: false
        command: []
        stdout: SplitParser {
            onRead: function (line) { service.handleTunerLine(line) }
        }
    }

    function handleTunerLine(line) {
        var msg
        try { msg = JSON.parse(line) } catch (error) { return }
        if (msg.type === "reading") {
            tunerReading = msg.frequency ? Object.assign({}, Pitch.frequencyToNote(msg.frequency, service.preferences.a4), { clarity: msg.clarity, rms: msg.rms }) : null
        } else if (msg.type === "error") {
            tunerAvailable = false
            lastError = msg.message
            tunerListening = false
        } else if (msg.type === "ready") {
            tunerAvailable = true
        }
    }

    function startTuner() {
        var args = [pythonBin, tunerHelperPath, "--sensitivity", tunerSensitivity()]
        if (tunerInputDevice) args = args.concat(["--target", tunerInputDevice])
        tunerProcess.command = args
        tunerAvailable = true
        tunerReading = null
        tunerProcess.running = true
        tunerListening = true
    }

    function stopTuner() {
        tunerProcess.running = false
        tunerListening = false
        tunerReading = null
    }

    function setTunerInputDevice(id) {
        tunerInputDevice = id || ""
        preferences = Object.assign({}, preferences, { tunerInputDevice: tunerInputDevice })
        requestSave()
        if (tunerListening) { stopTuner(); startTuner() }
    }

    function tunerSensitivity() {
        return preferences.tunerSensitivity || "normal"
    }

    // Quiet/Normal/Noisy Room only change the noise-floor/confidence
    // thresholds the tuner helper gates readings with - never microphone
    // gain - so switching sensitivity means restarting the helper process
    // with a different --sensitivity argument (same pattern as --target).
    function setTunerSensitivity(value) {
        var allowed = ["quiet", "normal", "noisy_room"]
        if (allowed.indexOf(value) < 0) return
        preferences = Object.assign({}, preferences, { tunerSensitivity: value })
        requestSave()
        if (tunerListening) { stopTuner(); startTuner() }
    }

    function setReferencePitch(a4) {
        var value = Number(a4)
        if (!isFinite(value) || value <= 0) return
        preferences = Object.assign({}, preferences, { a4: value })
        requestSave()
    }

    Process {
        id: deviceListProcess
        running: false
        command: [service.pythonBin, service.devicesHelperPath]
        stdout: StdioCollector { id: deviceListCollector; waitForEnd: true }
        onExited: function (code) {
            try { service.tunerDevices = JSON.parse(deviceListCollector.text || "[]") }
            catch (error) { service.tunerDevices = [] }
        }
    }

    function refreshTunerDevices() {
        if (deviceListProcess.running) return
        deviceListProcess.running = true
    }

    // ------------------------------------------------------------ reference (fretboard/scale/chord/circle)
    property string selectedTuningId: "standard"
    property string referenceKey: "C"
    property string referenceScaleId: "major"
    property string referenceChordId: "major"
    property string referenceMode: "scale" // "scale" | "triad" | "chord"
    property string referenceScalePosition: "all"
    property string referenceTriadQuality: "major"
    property string referenceTriadInversion: "all"
    property string referenceTriadStringSet: "all"
    property bool showIntervals: false
    property int fretCount: 24

    function currentTuning() {
        return Tunings.resolveTuning(selectedTuningId, customTunings)
    }

    function setTuning(id) {
        selectedTuningId = id
        preferences = Object.assign({}, preferences, { defaultTuningId: id })
        requestSave()
    }

    function addCustomTuning(name, notes) {
        var tuning = Tunings.createCustomTuning(name, notes)
        if (!tuning) return null
        customTunings = customTunings.concat([tuning])
        requestSave()
        return tuning
    }

    function removeCustomTuning(id) {
        customTunings = customTunings.filter(function (t) { return t.id !== id })
        if (selectedTuningId === id) setTuning("standard")
        requestSave()
    }

    function setReferenceKey(key) { referenceKey = key }
    function setReferenceScale(id) {
        referenceMode = "scale"
        referenceScaleId = id
        if (id !== "minor_pentatonic") referenceScalePosition = "all"
    }
    function setReferenceScalePosition(value) { referenceScalePosition = value }
    function setReferenceTriad(quality) { referenceMode = "triad"; referenceTriadQuality = quality }
    function setReferenceTriadInversion(value) { referenceTriadInversion = value }
    function setReferenceTriadStringSet(value) { referenceTriadStringSet = value }
    function setReferenceChord(id) { referenceMode = "chord"; referenceChordId = id }

    function currentToneData() {
        if (referenceMode === "chord") return Theory.buildChord(referenceKey, referenceChordId)
        if (referenceMode === "triad") return Theory.buildChord(referenceKey, referenceTriadQuality)
        return Theory.buildScale(referenceKey, referenceScaleId)
    }

    function currentTriadShapes() {
        if (referenceMode !== "triad" || selectedTuningId !== "standard") return []
        var tones = currentToneData()
        return tones ? VisualShapes.triadShapes(tones.rootPitchClass, referenceTriadQuality,
            referenceTriadInversion, referenceTriadStringSet,
            VisualShapes.FULL_FRETBOARD_START_FRET, VisualShapes.FULL_FRETBOARD_END_FRET) : []
    }

    function currentFretboard() {
        var tuning = currentTuning()
        var board = Fretboard.buildFretboard(tuning.notes, fretCount)
        var tones = currentToneData()
        if (!tones) return board
        var set = Theory.pitchClassSet(tones.notes)
        if (referenceMode === "scale" && referenceScaleId === "minor_pentatonic"
                && referenceScalePosition !== "all" && selectedTuningId === "standard") {
            var aid = { mode: VisualShapes.PENTATONIC_BOX, box: Number(referenceScalePosition), tuningId: "standard" }
            var positions = VisualShapes.positionsInRange(aid, tones.rootPitchClass,
                VisualShapes.FULL_FRETBOARD_START_FRET, VisualShapes.FULL_FRETBOARD_END_FRET)
            return VisualShapes.highlightContext(board, set, tones.rootPitchClass, positions, [])
        }
        if (referenceMode === "triad") {
            return VisualShapes.highlightContext(board, set, tones.rootPitchClass,
                VisualShapes.flattenShapePositions(currentTriadShapes()), [])
        }
        return Fretboard.highlightFretboard(board, set, tones.rootPitchClass)
    }

    function currentChordVoicings() {
        if (referenceMode !== "chord") return []
        var tuning = currentTuning()
        var chord = Theory.buildChord(referenceKey, referenceChordId)
        if (!chord) return []
        return Voicings.findVoicings(tuning.notes, Theory.pitchClassSet(chord.notes), chord.rootPitchClass, chord.chordId)
    }

    function selectCircleKey(entry, isMinor) {
        setReferenceKey(isMinor ? entry.minor.replace(/m$/, "") : entry.major)
        setReferenceScale(isMinor ? "natural_minor" : "major")
    }

    // ------------------------------------------------------------ routines
    function createRoutine(name, items) {
        var routine = Routines.createRoutine(name, items)
        routines = routines.concat([routine])
        requestSave()
        return routine
    }

    function updateRoutine(routine) {
        routines = routines.map(function (r) { return r.id === routine.id ? routine : r })
        requestSave()
    }

    function deleteRoutine(id) {
        routines = routines.filter(function (r) { return r.id !== id })
        requestSave()
    }

    function duplicateRoutineById(id) {
        var found = routines.find(function (r) { return r.id === id })
        if (!found) return null
        var copy = Routines.duplicateRoutine(found)
        routines = routines.concat([copy])
        requestSave()
        return copy
    }

    function reorderRoutineItem(id, fromIndex, toIndex) {
        var found = routines.find(function (r) { return r.id === id })
        if (!found) return
        updateRoutine(Routines.reorderItem(found, fromIndex, toIndex))
    }

    // ------------------------------------------------------------ routine runner (integrated practice mode)
    property var activeRoutine: null
    property var activeRun: null
    property bool routineAwaitingOutcome: false

    function startRoutine(id) {
        var routine = routines.find(function (r) { return r.id === id })
        startRoutineObject(routine)
    }

    function startPreset(id) {
        startRoutineObject(Presets.presetById(id))
    }

    function startRoutineObject(routine) {
        if (!routine || routine.items.length === 0) return
        if (jamActive) stopJam()
        activeRoutine = routine
        activeRun = Routines.startRun(routine)
        applyRoutineItem(Routines.currentItem(routine, activeRun))
    }

    function duplicatePreset(id) {
        var found = Presets.presetById(id)
        if (!found) return null
        var copy = Routines.duplicateRoutine(found)
        routines = routines.concat([copy])
        requestSave()
        return copy
    }

    function allPresets() { return Presets.PRESET_ROUTINES }
    function presetCategories() { return Presets.PRESET_CATEGORIES }
    function presetsByCategory(category) { return Presets.presetsByCategory(category) }
    function presetById(id) { return Presets.presetById(id) }

    // ------------------------------------------------------------ configurable routine templates (v0.5)
    //
    // A template is picked and *configured* (key/root/position/BPM/
    // duration/dynamic) at selection time instead of shipping one fixed
    // preset per key/box/quality combination. Triad-shape resolution needs
    // VisualShapes.triadShapes, which js/presets.js cannot import (see that
    // file's header) - this glue lives here, exactly like activeVisualBoard()
    // already combines Presets/VisualShapes/Theory for the same reason.
    // A configured routine is never persisted: it resolves to one ordinary
    // (optionally dynamic/staged) item, wrapped in a throwaway routine and
    // run through the existing startRoutineObject/activeRoutine machinery
    // unchanged - including the v0.4 stage engine when dynamic is enabled.

    readonly property var configurableTemplateIndex: Presets.SCALE_TEMPLATES.map(function (t) {
        return { id: t.id, name: t.name, category: t.category, kind: "scale", positions: t.positions }
    }).concat([
        { id: Presets.HYBRID_PENTATONIC_TEMPLATE.id, name: Presets.HYBRID_PENTATONIC_TEMPLATE.name, category: Presets.HYBRID_PENTATONIC_TEMPLATE.category, kind: "hybrid-pentatonic", positions: ["all", "box1", "box2", "box3", "box4", "box5"] },
        { id: "template-triad", name: "Configurable Triad", category: "Triads", kind: "triad" },
        { id: "template-hybrid-triad", name: "Hybrid Picking — Triad", category: "Technique", kind: "hybrid-triad" }
    ])

    function configurableCategories() {
        var seen = {}
        var list = []
        for (var i = 0; i < configurableTemplateIndex.length; i++) {
            var category = configurableTemplateIndex[i].category
            if (!seen[category]) { seen[category] = true; list.push(category) }
        }
        return list
    }

    function configurableTemplatesByCategory(category) {
        return configurableTemplateIndex.filter(function (t) { return t.category === category })
    }

    function configurableTemplateById(id) {
        for (var i = 0; i < configurableTemplateIndex.length; i++) if (configurableTemplateIndex[i].id === id) return configurableTemplateIndex[i]
        return null
    }

    function triadQualityLabel(quality) {
        return { major: "Major", minor: "Minor", diminished: "Diminished", augmented: "Augmented" }[quality] || quality
    }

    function resolveTriadTemplateItem(config, hybrid) {
        var c = config || {}
        var root = Presets.TRIAD_ROOTS.indexOf(c.root) >= 0 ? c.root : "A"
        var quality = Presets.TRIAD_QUALITIES.indexOf(c.quality) >= 0 ? c.quality : "major"
        var inversion = Presets.TRIAD_INVERSION_IDS.indexOf(c.inversion) >= 0 ? c.inversion : "root"
        var stringSet = Presets.TRIAD_STRING_SET_IDS.indexOf(c.stringSet) >= 0 ? c.stringSet : "123"
        var targetBpm = c.targetBpm || 70
        var durationMinutes = c.durationMinutes || 4
        var dynamic = !!c.dynamic
        var everySeconds = Math.max(15, c.dynamicEverySeconds || 80)
        var rootPitchClass = Theory.pitchClassIndex(root)

        function shapePositions(inv, set) {
            var shapes = VisualShapes.triadShapes(rootPitchClass, quality, inv, set, 0, 15)
            return shapes.length ? shapes[0].positions : null
        }
        function visualFor(inv, set) {
            var positions = shapePositions(inv, set)
            if (!positions) return null
            return hybrid ? Presets.pathAid("hybrid-triad-template-" + inv + "-" + set, positions, ["P", "M", "R"], "PICKING_PATTERN")
                : Presets.triadAid("triad-template-" + inv + "-" + set, positions)
        }
        function stageLabel(inv, set, cyclingInversions) {
            return cyclingInversions ? Presets.triadInversionLabel(inv) : Presets.triadStringSetLabel(set)
        }

        var qualityLabel = triadQualityLabel(quality)
        var base = {
            type: hybrid ? "technique" : "chord_changes",
            label: root + " " + qualityLabel + (hybrid ? " Hybrid Picking Triad" : " Triad"),
            durationMinutes: durationMinutes,
            targetBpm: targetBpm,
            metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" },
            notes: hybrid
                ? "Pick handles the lowest string of the set, middle and ring take the other two, together."
                : ("Standard tuning, " + root + " " + qualityLabel.toLowerCase() + " triad."),
            chordKey: { key: root, chordId: quality },
            tuningId: "standard"
        }

        if (dynamic && (inversion === "all" || stringSet === "all")) {
            var cyclingInversions = inversion === "all"
            var fixedSet = stringSet === "all" ? "123" : stringSet
            var fixedInversion = inversion === "all" ? "root" : inversion
            var sequence = cyclingInversions ? ["root", "first", "second"] : ["123", "234", "345", "456"]
            base.stages = sequence.map(function (value) {
                var inv = cyclingInversions ? value : fixedInversion
                var set = cyclingInversions ? fixedSet : value
                return Presets.stage(stageLabel(inv, set, cyclingInversions), { visualAid: visualFor(inv, set) })
            })
            base.advance = { mode: "time", everySeconds: everySeconds }
            base.durationMinutes = base.stages.length * everySeconds / 60
            base.visualAid = base.stages[0].visualAid
        } else {
            var resolvedInversion = inversion === "all" ? "root" : inversion
            var resolvedSet = stringSet === "all" ? "123" : stringSet
            base.visualAid = visualFor(resolvedInversion, resolvedSet)
        }

        return Routines.createItem(base)
    }

    // config shape varies by template kind:
    //  scale/hybrid-pentatonic: { key, position, targetBpm, durationMinutes,
    //    metronomeEnabled, dynamic, dynamicEverySeconds }
    //  triad/hybrid-triad: { root, quality, inversion, stringSet, targetBpm,
    //    durationMinutes, dynamic, dynamicEverySeconds }
    function resolveConfigurableRoutine(templateId, config) {
        var descriptor = configurableTemplateById(templateId)
        if (!descriptor) return null
        if (descriptor.kind === "scale") return Presets.resolveScaleTemplate(templateId, config)
        if (descriptor.kind === "hybrid-pentatonic") return Presets.resolveHybridPentatonicTemplate(config)
        if (descriptor.kind === "triad") return resolveTriadTemplateItem(config, false)
        if (descriptor.kind === "hybrid-triad") return resolveTriadTemplateItem(config, true)
        return null
    }

    function startConfiguredRoutine(templateId, config) {
        var item = resolveConfigurableRoutine(templateId, config)
        if (!item) return
        startRoutineObject(Routines.createRoutine(item.label, [item]))
    }

    function setRoutineBrowserSource(source) {
        var normalized = source === "mine" ? "mine" : "presets"
        if (preferences.routineSource === normalized) return
        preferences = Object.assign({}, preferences, { routineSource: normalized })
        requestSave()
    }

    function setRoutineBrowserCategory(category) {
        var normalized = typeof category === "string" && category ? category : "All"
        if (preferences.routineCategory === normalized) return
        preferences = Object.assign({}, preferences, { routineCategory: normalized })
        requestSave()
    }

    function setRoutineBrowserSelection(source, id) {
        var key = source === "mine" ? "routineUserId" : "routinePresetId"
        var value = typeof id === "string" ? id : ""
        if (preferences[key] === value) return
        var patch = {}
        patch[key] = value
        preferences = Object.assign({}, preferences, patch)
        requestSave()
    }

    // Shared by applyRoutineItem (item transition) and setStageIndex (stage
    // transition within one dynamic item): applies tuning/reference/
    // metronome/BPM for `effective`, the item that should actually be heard
    // and displayed right now. Never touches the practice timer or session
    // bookkeeping, which operate at the item level, not the stage level.
    function applyToneAndMetronome(effective, dynamic) {
        if (effective.tuningId) setTuning(effective.tuningId)
        if (effective.scaleKey) {
            setReferenceKey(effective.scaleKey.key || referenceKey)
            setReferenceScale(effective.scaleKey.scaleId || referenceScaleId)
        } else if (effective.chordKey) {
            setReferenceKey(effective.chordKey.key || referenceKey)
            setReferenceChord(effective.chordKey.chordId || referenceChordId)
        }
        if (effective.metronome) {
            if (effective.metronome.timeSignatureId) setTimeSignature(effective.metronome.timeSignatureId)
            if (effective.metronome.subdivisionId) setSubdivision(effective.metronome.subdivisionId)
        }
        // A dynamic item's own stage progression is the single authority for
        // its BPM/subdivision changes - it never also starts a tempo-trainer
        // ramp, which would be a second, conflicting progression clock.
        if (effective.targetBpm && effective.metronome && effective.metronome.startBpm && !dynamic) {
            startTempoTrainer({
                startBpm: effective.metronome.startBpm, targetBpm: effective.targetBpm,
                incrementBpm: effective.metronome.incrementBpm || 5,
                incrementMode: effective.metronome.incrementMode || "time",
                intervalSeconds: effective.metronome.intervalSeconds || 120,
                intervalBars: effective.metronome.intervalBars || 8
            })
        } else if (effective.targetBpm) {
            setMetronomeBpm(effective.targetBpm)
            if (!metronomeRunning) startMetronome()
        } else if (dynamic && effective.metronome && !metronomeRunning) {
            startMetronome()
        }
    }

    function applyRoutineItem(item) {
        if (!item) return
        var dynamic = Routines.hasStages(item)
        stageStages = dynamic ? item.stages : null
        stageAdvance = dynamic ? item.advance : null
        stageIndex = 0
        stageElapsedMs = 0
        stageResumedAt = Date.now()
        stageBarCount = 0
        stageRunning = dynamic
        applyToneAndMetronome(dynamic ? Routines.resolveStageItem(item, 0) : item, dynamic)
        if (item.durationMinutes) startPracticeTimer(item.durationMinutes * 60, false)
        routineAwaitingOutcome = false
    }

    function activeBaseItem() {
        if (!activeRoutine || !activeRun) return null
        return Routines.currentItem(activeRoutine, activeRun)
    }

    // The item actually shown/played right now: a dynamic item's current
    // stage resolved on top of it, or the plain item unchanged. Every
    // existing consumer (visual aid, fret window, chord voicings, tone data,
    // label/notes in the UI) reads through this one function, so dynamic
    // routines need no changes anywhere else.
    function activeItem() {
        var base = activeBaseItem()
        if (!base) return null
        return Routines.hasStages(base) ? Routines.resolveStageItem(base, stageIndex) : base
    }

    function activeNextItem() {
        if (!activeRoutine || !activeRun) return null
        return Routines.nextItem(activeRoutine, activeRun)
    }

    function activeToneData() {
        var item = activeItem()
        if (!item) return null
        if (item.scaleKey) return Theory.buildScale(item.scaleKey.key, item.scaleKey.scaleId)
        if (item.chordKey) return Theory.buildChord(item.chordKey.key, item.chordKey.chordId)
        return null
    }

    // General scales use the complete open-to-octave reference range. Exact
    // positional modes derive their window from their canonical coordinates.
    // The density helper remains only as a legacy fallback for unclassified
    // chord material; it must never turn a plain scale into a fake position.
    function activeItemFretWindow() {
        var item = activeItem()
        if (!item) return null
        if (item.scaleKey && item.visualAid && (item.visualAid.mode === VisualShapes.POSITION
                || item.visualAid.mode === VisualShapes.PENTATONIC_BOX)) return VisualShapes.fullFretboardWindow()
        if (item.visualAid) {
            var visualWindow = VisualShapes.fretWindow(item.visualAid, activeToneData() ? activeToneData().rootPitchClass : 0)
            if (visualWindow) return visualWindow
            if (item.visualAid.mode === VisualShapes.CHORD_SHAPE) return null
        }
        if (item.fretWindow) return { startFret: item.fretWindow[0], endFret: item.fretWindow[1] }
        if (item.scaleKey) return VisualShapes.fullFretboardWindow()
        var tones = activeToneData()
        if (!tones) return null
        return Fretboard.findPositionWindow(currentTuning().notes, Theory.pitchClassSet(tones.notes), fretCount, 5)
    }

    function activeVisualBoard() {
        var item = activeItem()
        var tones = currentToneData()
        if (!item) return null
        var board = Fretboard.buildFretboard(currentTuning().notes, fretCount)
        if (item.visualAid && (item.visualAid.mode === VisualShapes.FRETBOARD_PATH
                || item.visualAid.mode === VisualShapes.PICKING_PATTERN))
            return VisualShapes.highlightPositions(board, VisualShapes.positionsFor(item.visualAid, 0), -1, item.visualAid.sequence || [])
        if ((!item.scaleKey && !item.chordKey) || !tones) return null
        if (item.visualAid && item.scaleKey && (item.visualAid.mode === VisualShapes.POSITION
                || item.visualAid.mode === VisualShapes.PENTATONIC_BOX)) {
            var positions = VisualShapes.positionsInRange(item.visualAid, tones.rootPitchClass,
                VisualShapes.FULL_FRETBOARD_START_FRET, VisualShapes.FULL_FRETBOARD_END_FRET)
            return VisualShapes.highlightContext(board, Theory.pitchClassSet(tones.notes), tones.rootPitchClass,
                positions, item.visualAid.sequence || [])
        }
        if (item.visualAid && item.visualAid.mode !== VisualShapes.FULL_FRETBOARD_SCALE) {
            return VisualShapes.highlightPositions(board, VisualShapes.positionsFor(item.visualAid, tones.rootPitchClass), tones.rootPitchClass, item.visualAid.sequence || [])
        }
        return Fretboard.highlightFretboard(board, Theory.pitchClassSet(tones.notes), tones.rootPitchClass)
    }

    function activeItemShowsFretboard() {
        var item = activeItem()
        if (!item) return false
        if (item.visualAid && (item.visualAid.mode === VisualShapes.FRETBOARD_PATH
                || item.visualAid.mode === VisualShapes.PICKING_PATTERN)) return !!item.visualAid.positions
        return !!((item.scaleKey || item.chordKey) && activeToneData()
            && (!item.visualAid || item.visualAid.mode !== VisualShapes.CHORD_SHAPE))
    }

    function activeItemChordVoicings() {
        var item = activeItem()
        if (!item || !item.chordKey || !item.visualAid || item.visualAid.mode !== VisualShapes.CHORD_SHAPE) return []
        var chord = Theory.buildChord(item.chordKey.key, item.chordKey.chordId)
        var toneSet = Theory.pitchClassSet(chord.notes)
        if (item.visualAid.frets) {
            var exact = Voicings.voicingFromFrets(currentTuning().notes, item.visualAid.frets, toneSet, chord.rootPitchClass, item.label, "as diagrammed")
            return exact ? [exact] : []
        }
        return Voicings.findVoicings(currentTuning().notes, toneSet, chord.rootPitchClass, chord.chordId)
    }

    function advanceRoutine() {
        if (!activeRoutine || !activeRun) return
        stopMetronome()
        stopTempoTrainer()
        resetPracticeTimer()
        practiceTimerTotalSeconds = 0
        stageStages = null
        stageAdvance = null
        stageIndex = 0
        stageRunning = false
        activeRun = Routines.advance(activeRoutine, activeRun)
        if (activeRun.completed) {
            recordSession({
                startedAt: activeRun.startedAt,
                durationMinutes: Math.max(1, Math.round((Date.now() - activeRun.startedAt) / 60000)),
                routineId: activeRoutine.id,
                routineName: activeRoutine.name
            })
            activeRoutine = null
            activeRun = null
        } else {
            applyRoutineItem(Routines.currentItem(activeRoutine, activeRun))
        }
    }

    function stopRoutine() {
        stopMetronome()
        stopTempoTrainer()
        resetPracticeTimer()
        stageStages = null
        stageAdvance = null
        stageIndex = 0
        stageRunning = false
        activeRoutine = null
        activeRun = null
        routineAwaitingOutcome = false
    }

    // ------------------------------------------------------------ dynamic stage display helpers
    function activeStageCount() { return stageStages ? stageStages.length : 0 }
    function activeStageIsDynamic() { return !!stageStages }
    function activeStageSecondsRemaining() {
        if (!stageStages || !stageAdvance || stageAdvance.mode !== "time") return null
        return Math.ceil(StageEngine.stageSecondsRemaining(stageStages, stageAdvance, stageElapsedSeconds()))
    }
    function activeStageLabels() {
        if (!stageStages) return []
        return stageStages.map(function (s) { return s.label || "" })
    }

    // A tempo-tracked item (one with a targetBpm) asks Clean/Nearly/Needs
    // Work before moving on, reusing the same outcome -> next-BPM
    // suggestion model as a standalone exercise; anything else (a warmup
    // with no BPM target, a rhythm feel drill, ...) just advances.
    function requestAdvanceRoutine() {
        var item = activeItem()
        if (item && item.targetBpm) routineAwaitingOutcome = true
        else advanceRoutine()
    }

    function completeRoutineItem(outcome) {
        var item = activeItem()
        if (item && item.targetBpm) recordExerciseOutcome(item.id, metronomeBpm, outcome)
        routineAwaitingOutcome = false
        advanceRoutine()
    }

    // ------------------------------------------------------------ Jam Sessions (v0.5)
    //
    // A local, generated backing track: a chord progression drives the same
    // js/stage_engine.js used by v0.4 dynamic practice routines (one stage
    // per chord, bar-based advance), except the sequence *loops* for the
    // whole session instead of holding at the last chord - see
    // StageEngine's loopedAutoStageIndex/loopedStageBarsRemaining. The
    // audio helper's existing "metronome" click is replaced by a generated
    // bass/comp/drums render (helper/audio_engine.py's "jam" mode) driven by
    // the same bar-start beat messages that already feed stageBarCount.
    property bool jamActive: false
    property var jamStyleId: null
    property string jamKey: "A"
    property int jamTempo: 100
    property var jamStages: null
    property var jamAdvance: null
    property var jamParentScaleId: null
    property int jamStageIndex: 0
    property int jamBarCount: 0
    property double jamElapsedMs: 0
    property double jamResumedAt: 0
    property bool jamRunning: false
    property int jamTotalSeconds: 0
    property double jamStartedAt: 0

    function jamGenres() { return JamSessions.genres() }
    function jamStylesByGenre(genre) { return JamSessions.stylesByGenre(genre) }
    function jamStyleById(id) { return JamSessions.styleById(id) }
    function jamKeys() { return JamSessions.keys() }

    function jamElapsedSeconds() {
        var extra = jamRunning ? (Date.now() - jamResumedAt) : 0
        return (jamElapsedMs + extra) / 1000
    }

    function jamRemainingSeconds() {
        if (!jamActive || jamTotalSeconds <= 0) return 0
        return Math.max(0, jamTotalSeconds - Math.floor(jamElapsedSeconds()))
    }

    function startJam(styleId, key, tempo, durationMinutes) {
        var resolved = JamSessions.resolveProgression(styleId, key)
        if (!resolved) return
        stopMetronome()
        if (droneRunning) stopDrone()
        if (tempoTrainerActive) stopTempoTrainer()
        if (activeRoutine) stopRoutine()

        jamStyleId = styleId
        jamKey = resolved.keyName
        jamTempo = Metronome.clampBpm(tempo || resolved.style.defaultTempo)
        jamStages = resolved.stages
        jamAdvance = resolved.advance
        jamParentScaleId = resolved.parentScaleId
        jamStageIndex = 0
        jamBarCount = 0
        jamElapsedMs = 0
        jamResumedAt = Date.now()
        jamStartedAt = jamResumedAt
        jamRunning = true
        jamTotalSeconds = Math.max(60, Math.round((durationMinutes || 10) * 60))
        jamActive = true

        setTimeSignature(resolved.style.defaultTimeSignatureId)
        var first = jamStages[0]
        sendAudio({
            cmd: "start", mode: "jam", bpm: jamTempo, timeSignatureId: resolved.style.defaultTimeSignatureId,
            chordRoot: first.rootPitchClass, chordQuality: first.quality, feel: resolved.style.feel, volume: metronomeVolume
        })
    }

    function pauseJam() {
        if (!jamActive || !jamRunning) return
        jamElapsedMs += Date.now() - jamResumedAt
        jamRunning = false
        sendAudio({ cmd: "stop" })
    }

    function resumeJam() {
        if (!jamActive || jamRunning || jamRemainingSeconds() <= 0) return
        jamResumedAt = Date.now()
        jamRunning = true
        var current = jamStages[jamStageIndex]
        sendAudio({ cmd: "start", mode: "jam", bpm: jamTempo, chordRoot: current.rootPitchClass, chordQuality: current.quality, volume: metronomeVolume })
    }

    function stopJam() {
        if (jamActive) {
            var style = jamStyleById(jamStyleId)
            recordSession({
                startedAt: jamStartedAt,
                durationMinutes: Math.max(1, Math.round(jamElapsedSeconds() / 60)),
                routineName: "Jam: " + (style ? style.label : "") + " in " + jamKey
            })
        }
        sendAudio({ cmd: "stop" })
        jamActive = false
        jamRunning = false
        jamStages = null
        jamAdvance = null
        jamStageIndex = 0
    }

    function setJamTempo(bpm) {
        jamTempo = Metronome.clampBpm(bpm)
        if (jamActive) sendAudio({ cmd: "update", mode: "jam", bpm: jamTempo })
    }

    function adjustJamTempo(delta) { setJamTempo(Metronome.adjustBpm(jamTempo, delta)) }

    Timer {
        id: jamTicker
        interval: 250
        repeat: true
        running: service.jamActive && service.jamRunning
        onTriggered: service.evaluateJamProgression()
    }

    function evaluateJamProgression() {
        if (!jamActive || !jamStages || !jamStages.length) return
        if (jamRemainingSeconds() <= 0) { stopJam(); return }
        var next = StageEngine.loopedAutoStageIndex(jamStages, jamAdvance, jamElapsedSeconds(), jamBarCount)
        if (next !== jamStageIndex) {
            jamStageIndex = next
            var stageObj = jamStages[jamStageIndex]
            sendAudio({ cmd: "update", mode: "jam", chordRoot: stageObj.rootPitchClass, chordQuality: stageObj.quality })
        }
    }

    function activeJamStage() {
        if (!jamActive || !jamStages || !jamStages.length) return null
        return jamStages[jamStageIndex]
    }

    function activeJamNextStage() {
        if (!jamActive || !jamStages || !jamStages.length) return null
        return jamStages[(jamStageIndex + 1) % jamStages.length]
    }

    function jamBarsRemainingInStage() {
        if (!jamActive || !jamStages) return 0
        return Math.ceil(StageEngine.loopedStageBarsRemaining(jamStages, jamAdvance, jamBarCount))
    }

    function jamTotalBars() {
        if (!jamActive || !jamStages) return 0
        return jamStages.length * (jamAdvance ? jamAdvance.everyBars : 1)
    }

    function jamCurrentBarNumber() {
        if (!jamActive || !jamStages || !jamAdvance) return 0
        var everyBars = jamAdvance.everyBars
        var barsIntoStage = everyBars - jamBarsRemainingInStage()
        return jamStageIndex * everyBars + Math.max(1, barsIntoStage + 1)
    }

    // Fretboard guidance: current chord tones emphasized, with the tonic
    // blues/pentatonic scale kept visible as context for Blues styles
    // (reusing the existing verified scale-membership engine, not a new
    // chord-scale theory claim) - jazz styles show chord-tone membership
    // only, matching "don't overpromise theory guidance".
    function jamFretboardBoard() {
        var stageObj = activeJamStage()
        if (!stageObj) return null
        var board = Fretboard.buildFretboard(currentTuning().notes, fretCount)
        var chordSet = {}
        var intervals = { major: [0, 4, 7], minor: [0, 3, 7], dominant7: [0, 4, 7, 10],
            major7: [0, 4, 7, 11], minor7: [0, 3, 7, 10], minor7b5: [0, 3, 6, 10], diminished7: [0, 3, 6, 9] }[stageObj.quality] || [0, 4, 7]
        for (var i = 0; i < intervals.length; i++) chordSet[(stageObj.rootPitchClass + intervals[i]) % 12] = true

        if (jamParentScaleId) {
            var scale = Theory.buildScale(jamKey, jamParentScaleId)
            if (scale) {
                var scaleSet = Theory.pitchClassSet(scale.notes)
                var chordCells = []
                for (var s = 0; s < board.strings.length; s++)
                    for (var f = 0; f < board.strings[s].length; f++)
                        if (chordSet[board.strings[s][f].pitchClass]) chordCells.push([s, f])
                return VisualShapes.highlightContext(board, scaleSet, scale.rootPitchClass, chordCells, [])
            }
        }
        return Fretboard.highlightFretboard(board, chordSet, stageObj.rootPitchClass)
    }

    // ------------------------------------------------------------ exercises / progress
    function allExercises() {
        return Exercises.BUILTIN_EXERCISES.concat(exercises)
    }

    function createCustomExercise(exercise) {
        var withId = Object.assign({}, exercise, { id: exercise.id || ("custom-exercise-" + Date.now()) })
        exercises = exercises.concat([withId])
        requestSave()
        return withId
    }

    function recordExerciseOutcome(exerciseId, bpm, outcome) {
        var suggestion = Progress.suggestNextBpm(bpm, outcome)
        var existing = exerciseProgress[exerciseId] || { bestBpm: bpm, goalBpm: suggestion.max, history: [] }
        var updated = Object.assign({}, existing, {
            bestBpm: outcome === "clean" ? Math.max(existing.bestBpm || 0, bpm) : existing.bestBpm,
            history: (existing.history || []).concat([{ at: Date.now(), bpm: bpm, outcome: outcome }])
        })
        var next = Object.assign({}, exerciseProgress)
        next[exerciseId] = updated
        exerciseProgress = next
        requestSave()
        return suggestion
    }

    // ------------------------------------------------------------ songs
    function createSong(song) {
        var withId = Object.assign({}, song, { id: song.id || ("song-" + Date.now()) })
        songs = songs.concat([withId])
        requestSave()
        return withId
    }

    function updateSong(song) {
        songs = songs.map(function (s) { return s.id === song.id ? song : s })
        requestSave()
    }

    function deleteSong(id) {
        songs = songs.filter(function (s) { return s.id !== id })
        requestSave()
    }

    // ------------------------------------------------------------ history / progress view
    function recordSession(session) {
        sessions = sessions.concat([Object.assign({ startedAt: Date.now(), durationMinutes: 0 }, session)])
        requestSave()
    }

    function minutesToday() { return Progress.minutesToday(sessions, Date.now()) }
    function minutesThisWeek() { return Progress.minutesThisWeek(sessions, Date.now()) }
    function sessionsThisWeek() { return Progress.sessionsThisWeek(sessions, Date.now()) }
    function currentStreak() { return Progress.currentStreak(sessions, Date.now()) }
    function totalPracticeMinutes() { return Progress.totalPracticeMinutes(sessions) }

    Component.onDestruction: {
        audioProcess.running = false
        tunerProcess.running = false
    }
}
