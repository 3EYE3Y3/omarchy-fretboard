pragma ComponentBehavior: Bound
import QtQuick
import Quickshell
import Quickshell.Io
import "js/storage.js" as Storage
import "js/metronome.js" as Metronome
import "js/tempo_trainer.js" as Trainer
import "js/pitch.js" as Pitch
import "js/tunings.js" as Tunings
import "js/theory.js" as Theory
import "js/fretboard.js" as Fretboard
import "js/chord_voicings.js" as Voicings
import "js/routines.js" as Routines
import "js/progress.js" as Progress
import "js/exercises.js" as Exercises
import "js/presets.js" as Presets

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

    function pausePracticeTimer() { practiceTimerRunning = false }
    function resumePracticeTimer() { if (practiceTimerRemainingSeconds > 0) practiceTimerRunning = true }

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
    property string referenceMode: "scale" // "scale" | "chord"
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
    function setReferenceScale(id) { referenceMode = "scale"; referenceScaleId = id }
    function setReferenceChord(id) { referenceMode = "chord"; referenceChordId = id }

    function currentToneData() {
        if (referenceMode === "chord") return Theory.buildChord(referenceKey, referenceChordId)
        return Theory.buildScale(referenceKey, referenceScaleId)
    }

    function currentFretboard() {
        var tuning = currentTuning()
        var board = Fretboard.buildFretboard(tuning.notes, fretCount)
        var tones = currentToneData()
        if (!tones) return board
        var set = Theory.pitchClassSet(tones.notes)
        return Fretboard.highlightFretboard(board, set, tones.rootPitchClass)
    }

    function currentChordVoicings() {
        if (referenceMode !== "chord") return []
        var tuning = currentTuning()
        var chord = Theory.buildChord(referenceKey, referenceChordId)
        if (!chord) return []
        return Voicings.findVoicings(tuning.notes, Theory.pitchClassSet(chord.notes), chord.rootPitchClass)
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

    function applyRoutineItem(item) {
        if (!item) return
        if (item.scaleKey) {
            setReferenceKey(item.scaleKey.key || referenceKey)
            setReferenceScale(item.scaleKey.scaleId || referenceScaleId)
        } else if (item.chordKey) {
            setReferenceKey(item.chordKey.key || referenceKey)
            setReferenceChord(item.chordKey.chordId || referenceChordId)
        }
        if (item.metronome) {
            if (item.metronome.timeSignatureId) setTimeSignature(item.metronome.timeSignatureId)
            if (item.metronome.subdivisionId) setSubdivision(item.metronome.subdivisionId)
        }
        if (item.targetBpm && item.metronome && item.metronome.startBpm) {
            startTempoTrainer({
                startBpm: item.metronome.startBpm, targetBpm: item.targetBpm,
                incrementBpm: item.metronome.incrementBpm || 5,
                incrementMode: item.metronome.incrementMode || "time",
                intervalSeconds: item.metronome.intervalSeconds || 120,
                intervalBars: item.metronome.intervalBars || 8
            })
        } else if (item.targetBpm) {
            setMetronomeBpm(item.targetBpm)
            startMetronome()
        }
        if (item.durationMinutes) startPracticeTimer(item.durationMinutes * 60, false)
        routineAwaitingOutcome = false
    }

    function activeItem() {
        if (!activeRoutine || !activeRun) return null
        return Routines.currentItem(activeRoutine, activeRun)
    }

    function activeNextItem() {
        if (!activeRoutine || !activeRun) return null
        return Routines.nextItem(activeRoutine, activeRun)
    }

    // The visual aid's fret window for the item currently running: an
    // author-specified window if the item has one, otherwise a generic
    // "most scale/chord tones in a compact span" window computed fresh
    // from the current tuning (see Fretboard.findPositionWindow).
    function activeItemFretWindow() {
        var item = activeItem()
        if (!item) return null
        if (item.fretWindow) return { startFret: item.fretWindow[0], endFret: item.fretWindow[1] }
        var tones = currentToneData()
        if (!tones) return null
        return Fretboard.findPositionWindow(currentTuning().notes, Theory.pitchClassSet(tones.notes), fretCount, 5)
    }

    function advanceRoutine() {
        if (!activeRoutine || !activeRun) return
        stopMetronome()
        stopTempoTrainer()
        resetPracticeTimer()
        practiceTimerTotalSeconds = 0
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
        activeRoutine = null
        activeRun = null
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
