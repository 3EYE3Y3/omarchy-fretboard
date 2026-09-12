pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "../js/metronome.js" as Metronome
import "../js/theory.js" as Theory
import "../js/fretboard.js" as Fretboard
import "../js/visual_shapes.js" as VisualShapes
import "../js/chord_voicings.js" as Voicings
import "../js/tunings.js" as Tunings
import "../js/preset_browser.js" as PresetBrowser

Item {
    id: root
    property var service: null
    property var bar: null
    property string mode: "metronome" // metronome | routines | trainer | timer
    readonly property var routineSelectorState: PresetBrowser.selectorState(
        service && service.preferences ? service.preferences.routineSource : "presets",
        service ? service.allPresets() : [],
        service ? service.presetCategories() : [],
        service ? service.routines : [],
        service && service.preferences ? service.preferences : {})
    implicitHeight: layout.implicitHeight
    Layout.fillWidth: true

    // Routines sits second, right beside Metronome - the two tools most
    // practice sessions actually open with.
    readonly property var modeOptions: [
        { value: "metronome", label: "Metronome" },
        { value: "routines", label: "Routines" },
        { value: "trainer", label: "Tempo Trainer" },
        { value: "timer", label: "Timer" }
    ]

    ColumnLayout {
        id: layout
        width: parent.width
        spacing: Style.spacing.md

        ButtonGroup {
            Layout.fillWidth: true
            options: root.modeOptions
            value: root.mode
            foreground: Color.foreground
            accent: Color.accent
            onChanged: function (value) { root.mode = value }
        }

        Loader {
            Layout.fillWidth: true
            sourceComponent: root.mode === "trainer" ? trainerView
                : root.mode === "timer" ? timerView
                : root.mode === "routines" ? routinesView
                : metronomeView
        }
    }

    // ------------------------------------------------------------ metronome
    Component {
        id: metronomeView
        ColumnLayout {
            width: layout.width
            spacing: Style.spacing.md

            RowLayout {
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignHCenter
                spacing: Style.spacing.md

                Button {
                    focusable: true
                    text: "−"
                    foreground: Color.foreground
                    accent: Color.accent
                    onClicked: if (root.service) root.service.adjustMetronomeBpm(-1)
                }
                NumberField {
                    label: ""
                    value: root.service ? root.service.metronomeBpm : 120
                    from: 30
                    to: 300
                    stepSize: 1
                    fontSize: Style.font.title
                    onModified: function (value) { if (root.service) root.service.setMetronomeBpm(value) }
                }
                Button {
                    focusable: true
                    text: "+"
                    foreground: Color.foreground
                    accent: Color.accent
                    onClicked: if (root.service) root.service.adjustMetronomeBpm(1)
                }
                Text { text: "BPM"; color: Color.foreground; opacity: 0.6; font.family: Style.font.family; font.pixelSize: Style.font.caption }
            }

            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: Style.spacing.md

                Button {
                    focusable: true
                    text: root.service && root.service.metronomeRunning ? "Stop" : "Start"
                    bordered: true
                    selected: root.service ? root.service.metronomeRunning : false
                    foreground: Color.foreground
                    accent: Color.accent
                    onClicked: if (root.service) root.service.toggleMetronome()
                }
                Button {
                    focusable: true
                    text: "Tap Tempo"
                    bordered: true
                    foreground: Color.foreground
                    accent: Color.accent
                    onClicked: if (root.service) root.service.tapTempo()
                }
            }

            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: Style.spacing.sm
                Repeater {
                    model: Metronome.timeSignatureById(root.timeSignatureId).beatsPerBar
                    delegate: Rectangle {
                        required property int index
                        width: Style.space(16)
                        height: Style.space(16)
                        radius: width / 2
                        color: root.isCurrentBeat(index) ? Color.accent : Color.foreground
                        opacity: root.isCurrentBeat(index) ? 1 : 0.25
                        Behavior on opacity { NumberAnimation { duration: 90 } }
                    }
                }
            }

            PanelSectionHeader { text: "Time Signature" }
            ButtonGroup {
                Layout.fillWidth: true
                options: Metronome.TIME_SIGNATURES.map(function (t) { return { value: t.id, label: t.label } })
                value: root.service ? root.service.timeSignatureId : "4-4"
                foreground: Color.foreground
                accent: Color.accent
                onChanged: function (value) { if (root.service) root.service.setTimeSignature(value) }
            }

            PanelSectionHeader { text: "Subdivision" }
            ButtonGroup {
                Layout.fillWidth: true
                options: Metronome.SUBDIVISIONS.map(function (s) { return { value: s.id, label: s.label } })
                value: root.service ? root.service.subdivisionId : "quarter"
                foreground: Color.foreground
                accent: Color.accent
                onChanged: function (value) { if (root.service) root.service.setSubdivision(value) }
            }

            PanelSectionHeader { text: "Volume" }
            PanelSlider {
                Layout.fillWidth: true
                bar: root.bar
                minimum: 0
                maximum: 1
                step: 0.05
                value: root.service ? root.service.metronomeVolume : 0.8
                onMoved: function (value) { if (root.service) root.service.setMetronomeVolume(value) }
            }
        }
    }

    function isCurrentBeat(index) {
        return service && service.lastBeat && service.metronomeRunning && service.lastBeat.beatIndex === index
    }

    property string timeSignatureId: service ? service.timeSignatureId : "4-4"

    // ------------------------------------------------------------ tempo trainer
    Component {
        id: trainerView
        ColumnLayout {
            width: layout.width
            spacing: Style.spacing.md

            RowLayout {
                spacing: Style.spacing.lg
                NumberField { label: "Start BPM"; value: 80; from: 30; to: 300; id: startBpmField }
                NumberField { label: "Target BPM"; value: 120; from: 30; to: 300; id: targetBpmField }
                NumberField { label: "Increment"; value: 5; from: 1; to: 50; id: incrementField }
            }

            PanelSectionHeader { text: "Increase By" }
            ButtonGroup {
                id: modeGroup
                Layout.fillWidth: true
                options: [{ value: "time", label: "Elapsed Time" }, { value: "bars", label: "Number of Bars" }]
                value: "time"
                foreground: Color.foreground
                accent: Color.accent
                onChanged: function (value) { modeGroup.value = value }
            }

            RowLayout {
                spacing: Style.spacing.lg
                NumberField { visible: modeGroup.value === "time"; label: "Every (seconds)"; value: 120; from: 5; to: 3600; id: intervalSecondsField }
                NumberField { visible: modeGroup.value === "bars"; label: "Every (bars)"; value: 8; from: 1; to: 64; id: intervalBarsField }
            }

            RowLayout {
                spacing: Style.spacing.md
                Button {
                    focusable: true
                    text: "Start"
                    bordered: true
                    foreground: Color.foreground
                    accent: Color.accent
                    enabled: !(root.service && root.service.tempoTrainerActive)
                    onClicked: if (root.service) root.service.startTempoTrainer({
                        startBpm: startBpmField.value, targetBpm: targetBpmField.value,
                        incrementBpm: incrementField.value, incrementMode: modeGroup.value,
                        intervalSeconds: intervalSecondsField.value, intervalBars: intervalBarsField.value
                    })
                }
                Button {
                    focusable: true
                    text: (root.service && root.service.tempoTrainerRunning) ? "Pause" : "Resume"
                    bordered: true
                    foreground: Color.foreground
                    accent: Color.accent
                    enabled: root.service ? root.service.tempoTrainerActive : false
                    onClicked: {
                        if (!root.service) return
                        if (root.service.tempoTrainerRunning) root.service.pauseTempoTrainer()
                        else root.service.resumeTempoTrainer()
                    }
                }
                Button {
                    focusable: true
                    text: "Reset"
                    bordered: true
                    foreground: Color.foreground
                    accent: Color.accent
                    enabled: root.service ? root.service.tempoTrainerActive : false
                    onClicked: if (root.service) root.service.resetTempoTrainer()
                }
                Button {
                    focusable: true
                    text: "Stop"
                    bordered: true
                    foreground: Color.foreground
                    accent: Color.accent
                    enabled: root.service ? root.service.tempoTrainerActive : false
                    onClicked: if (root.service) { root.service.stopTempoTrainer(); root.service.stopMetronome() }
                }
            }

            ColumnLayout {
                visible: root.service ? root.service.tempoTrainerActive : false
                spacing: Style.spacing.xs
                Text {
                    text: "Current: " + (root.service ? root.service.metronomeBpm : 0) + " BPM"
                    color: Color.foreground
                    font.family: Style.font.family
                    font.pixelSize: Style.font.subtitle
                    font.bold: true
                }
                Text {
                    text: (root.service && root.service.tempoTrainerFinished) ? "Target reached!" :
                        "Target " + (root.service && root.service.tempoTrainerPlan ? root.service.tempoTrainerPlan.targetBpm : "") + " BPM"
                    color: Color.foreground
                    opacity: 0.7
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                }
            }
        }
    }

    // ------------------------------------------------------------ practice timer
    Component {
        id: timerView
        ColumnLayout {
            width: layout.width
            spacing: Style.spacing.md

            PanelSectionHeader { text: "Presets (minutes)" }
            ButtonGroup {
                id: presetGroup
                Layout.fillWidth: true
                options: ["5", "10", "15", "20", "30", "45", "60", "Custom"]
                value: "10"
                foreground: Color.foreground
                accent: Color.accent
                onChanged: function (value) { presetGroup.value = value }
            }
            RowLayout {
                spacing: Style.spacing.md
                NumberField { id: customMinutes; label: "Custom minutes"; value: 10; from: 1; to: 240; enabled: presetGroup.value === "Custom" }
                Toggle {
                    id: linkMetronomeToggle
                    label: "Run metronome"
                    description: "Start/stop the metronome with this timer"
                    foreground: Color.foreground
                    accent: Color.accent
                    onClicked: linkMetronomeToggle.checked = !linkMetronomeToggle.checked
                }
            }

            RowLayout {
                spacing: Style.spacing.md
                Button {
                    focusable: true
                    text: "Start"
                    bordered: true
                    foreground: Color.foreground
                    accent: Color.accent
                    onClicked: if (root.service) root.service.startPracticeTimer(Number(presetGroup.value === "Custom" ? customMinutes.value : presetGroup.value) * 60, linkMetronomeToggle.checked)
                }
                Button {
                    focusable: true
                    text: (root.service && root.service.practiceTimerRunning) ? "Pause" : "Resume"
                    bordered: true
                    foreground: Color.foreground
                    accent: Color.accent
                    enabled: root.service ? root.service.practiceTimerTotalSeconds > 0 : false
                    onClicked: {
                        if (!root.service) return
                        if (root.service.practiceTimerRunning) root.service.pausePracticeTimer()
                        else root.service.resumePracticeTimer()
                    }
                }
                Button {
                    focusable: true
                    text: "Reset"
                    bordered: true
                    foreground: Color.foreground
                    accent: Color.accent
                    enabled: root.service ? root.service.practiceTimerTotalSeconds > 0 : false
                    onClicked: if (root.service) root.service.resetPracticeTimer()
                }
            }

            Text {
                visible: root.service ? root.service.practiceTimerTotalSeconds > 0 : false
                text: root.formatSeconds(root.service ? root.service.practiceTimerRemainingSeconds : 0) + " remaining"
                color: (root.service && root.service.practiceTimerCompleted) ? Color.accent : Color.foreground
                font.family: Style.font.family
                font.pixelSize: Style.font.title
                font.bold: true
            }
            Text {
                visible: root.service ? root.service.practiceTimerCompleted : false
                text: "Session complete"
                color: Color.accent
                font.family: Style.font.family
                font.pixelSize: Style.font.body
            }
        }
    }

    function formatSeconds(totalSeconds) {
        var m = Math.floor(totalSeconds / 60)
        var s = totalSeconds % 60
        return m + ":" + (s < 10 ? "0" : "") + s
    }

    // ------------------------------------------------------------ preview helpers (read-only - never touch live reference state)
    function previewToneData(item) {
        if (!item) return null
        if (item.scaleKey) return Theory.buildScale(item.scaleKey.key, item.scaleKey.scaleId)
        if (item.chordKey) return Theory.buildChord(item.chordKey.key, item.chordKey.chordId)
        return null
    }

    function previewBoard(item) {
        if (!root.service) return null
        var tones = previewToneData(item)
        var tuning = root.previewTuning(item)
        var board = Fretboard.buildFretboard(tuning.notes, root.service.fretCount)
        if (!tones && item && item.visualAid && (item.visualAid.mode === VisualShapes.FRETBOARD_PATH
                || item.visualAid.mode === VisualShapes.PICKING_PATTERN))
            return VisualShapes.highlightPositions(board, VisualShapes.positionsFor(item.visualAid, 0), -1, item.visualAid.sequence || [])
        if (!tones) return null
        if (item.visualAid && (item.visualAid.mode === VisualShapes.POSITION || item.visualAid.mode === VisualShapes.PENTATONIC_BOX)) {
            var positions = VisualShapes.positionsInRange(item.visualAid, tones.rootPitchClass,
                VisualShapes.FULL_FRETBOARD_START_FRET, VisualShapes.FULL_FRETBOARD_END_FRET)
            return VisualShapes.highlightContext(board, Theory.pitchClassSet(tones.notes), tones.rootPitchClass,
                positions, item.visualAid.sequence || [])
        }
        if (item.visualAid && item.visualAid.mode !== VisualShapes.FULL_FRETBOARD_SCALE)
            return VisualShapes.highlightPositions(board, VisualShapes.positionsFor(item.visualAid, tones.rootPitchClass), tones.rootPitchClass, item.visualAid.sequence || [])
        return Fretboard.highlightFretboard(board, Theory.pitchClassSet(tones.notes), tones.rootPitchClass)
    }

    function previewVoicings(item) {
        if (!root.service || !item || !item.chordKey) return []
        var tuning = root.previewTuning(item)
        var chord = Theory.buildChord(item.chordKey.key, item.chordKey.chordId)
        if (!chord) return []
        var toneSet = Theory.pitchClassSet(chord.notes)
        if (item.visualAid && item.visualAid.frets) {
            var exact = Voicings.voicingFromFrets(tuning.notes, item.visualAid.frets, toneSet, chord.rootPitchClass, item.label, "as diagrammed")
            return exact ? [exact] : []
        }
        return Voicings.findVoicings(tuning.notes, toneSet, chord.rootPitchClass, chord.chordId)
    }

    function previewFretWindow(item) {
        if (!root.service || !item) return null
        if (item.scaleKey && item.visualAid && (item.visualAid.mode === VisualShapes.POSITION
                || item.visualAid.mode === VisualShapes.PENTATONIC_BOX)) return VisualShapes.fullFretboardWindow()
        if (item.visualAid) {
            var tonesForAid = previewToneData(item)
            var visualWindow = VisualShapes.fretWindow(item.visualAid, tonesForAid ? tonesForAid.rootPitchClass : 0)
            if (visualWindow) return visualWindow
            if (item.visualAid.mode === VisualShapes.CHORD_SHAPE) return null
        }
        if (item.fretWindow) return { startFret: item.fretWindow[0], endFret: item.fretWindow[1] }
        if (item.scaleKey) return VisualShapes.fullFretboardWindow()
        var tones = previewToneData(item)
        if (!tones) return null
        return Fretboard.findPositionWindow(root.previewTuning(item).notes, Theory.pitchClassSet(tones.notes), root.service.fretCount, 5)
    }

    function previewTuning(item) {
        if (!root.service) return null
        return item && item.tuningId ? Tunings.resolveTuning(item.tuningId, root.service.customTunings) : root.service.currentTuning()
    }

    function previewShowsFretboard(item) {
        if (!item || !item.visualAid) return !!previewToneData(item)
        if (item.visualAid.mode === VisualShapes.FRETBOARD_PATH || item.visualAid.mode === VisualShapes.PICKING_PATTERN)
            return !!item.visualAid.positions
        return !!previewToneData(item) && item.visualAid.mode !== VisualShapes.CHORD_SHAPE
    }

    function previewShowsChordDiagram(item) {
        return !!item.chordKey && !!item.visualAid && item.visualAid.mode === VisualShapes.CHORD_SHAPE
    }

    function previewStringLabels(item) {
        var tuning = previewTuning(item)
        return tuning ? tuning.notes.map(function (n) { return n.replace(/[0-9-]/g, "") }) : []
    }

    function stringLabelsFor(service) {
        var tuning = service ? service.currentTuning() : null
        if (!tuning) return []
        return tuning.notes.map(function (n) { return n.replace(/[0-9-]/g, "") })
    }

    // ------------------------------------------------------------ routines (presets + my routines + running)
    Component {
        id: routinesView
        ColumnLayout {
            id: routinesRoot
            width: layout.width
            spacing: Style.spacing.md
            readonly property var selector: root.routineSelectorState
            readonly property string subMode: selector.source
            readonly property string category: selector.category
            readonly property var chosen: selector.selected
            readonly property var selectedItem: chosen && chosen.items.length ? chosen.items[0] : null
            property bool editorOpen: false
            property string editorName: ""
            property var editorItems: []

            onSubModeChanged: cancelEdit()

            function suggestedBpm(item) {
                if (!item) return "—"
                return item.targetBpm || (item.metronome ? item.metronome.startBpm : null) || "—"
            }

            function metronomeSummary(item) {
                if (!item || !item.metronome) return "Optional"
                var meter = (item.metronome.timeSignatureId || "4-4").replace("-", "/")
                var subdivision = (item.metronome.subdivisionId || "quarter").replace(/_/g, " ")
                return meter + " · " + subdivision
            }

            function beginEdit() {
                if (!chosen || subMode !== "mine") return
                editorName = chosen.name
                editorItems = chosen.items.slice()
                editorOpen = true
            }

            function cancelEdit() {
                editorOpen = false
                editorName = ""
                editorItems = []
            }

            function saveEdit() {
                if (!root.service || !chosen || !editorName.trim() || editorItems.length === 0) return
                root.service.updateRoutine(Object.assign({}, chosen, {
                    name: editorName.trim(), items: editorItems.slice(), updatedAt: Date.now()
                }))
                cancelEdit()
            }

            function duplicateSelected() {
                if (!root.service || !chosen) return
                var copy = subMode === "mine" ? root.service.duplicateRoutineById(chosen.id)
                    : root.service.duplicatePreset(chosen.id)
                if (!copy) return
                root.service.setRoutineBrowserSource("mine")
                root.service.setRoutineBrowserSelection("mine", copy.id)
                cancelEdit()
            }

            function deleteSelected() {
                if (!root.service || !chosen || subMode !== "mine") return
                var remaining = root.service.routines.filter(function (routine) { return routine.id !== chosen.id })
                var fallback = PresetBrowser.selectedRoutine(remaining, "")
                root.service.deleteRoutine(chosen.id)
                root.service.setRoutineBrowserSelection("mine", fallback ? fallback.id : "")
                cancelEdit()
            }

            // ---- running panel: shown prominently whenever a routine is active ----
            ColumnLayout {
                visible: root.service ? !!root.service.activeRoutine : false
                Layout.fillWidth: true
                spacing: Style.spacing.sm

                Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Color.accent; opacity: 0.35 }

                RowLayout {
                    Layout.fillWidth: true
                    PanelSectionHeader { text: "Running: " + (root.service && root.service.activeRoutine ? root.service.activeRoutine.name : "") }
                    Item { Layout.fillWidth: true }
                    Text {
                        text: root.service ? Math.round(root.service.activeRoutine && root.service.activeRun ? 100 * (root.service.activeRun.currentIndex / Math.max(1, root.service.activeRoutine.items.length)) : 0) + "%" : ""
                        color: Color.foreground
                        opacity: 0.6
                        font.family: Style.font.family
                        font.pixelSize: Style.font.caption
                    }
                }

                Text {
                    text: root.service && root.service.activeItem() ? root.service.activeItem().label : ""
                    color: Color.foreground
                    font.family: Style.font.family
                    font.pixelSize: Style.font.heading
                    font.bold: true
                }
                Text {
                    visible: root.service && root.service.activeItem() ? root.service.activeItem().notes !== "" : false
                    Layout.fillWidth: true
                    wrapMode: Text.WordWrap
                    text: root.service && root.service.activeItem() ? root.service.activeItem().notes : ""
                    color: Color.foreground
                    opacity: 0.75
                    font.family: Style.font.family
                    font.pixelSize: Style.font.body
                }

                // The same data-driven teaching visual used in the browser is
                // retained while the player is holding the guitar.
                PracticeVisual {
                    Layout.fillWidth: true
                    item: root.service ? root.service.activeItem() : null
                    board: root.service ? root.service.activeVisualBoard() : null
                    stringLabels: root.stringLabelsFor(root.service)
                    showIntervals: root.service ? root.service.showIntervals : false
                    toneData: root.service ? root.service.activeToneData() : null
                    voicings: root.service ? root.service.activeItemChordVoicings() : []
                    fretWindow: root.service ? root.service.activeItemFretWindow() : null
                    showFretboard: root.service ? root.service.activeItemShowsFretboard() : false
                    showChord: root.service ? root.service.activeItemChordVoicings().length > 0 : false
                }

                RowLayout {
                    Layout.fillWidth: true
                    spacing: Style.spacing.lg
                    Text {
                        text: (root.service ? root.service.metronomeBpm : "") + " BPM"
                        color: Color.accent
                        font.family: Style.font.family
                        font.pixelSize: Style.font.title
                        font.bold: true
                    }
                    Button { focusable: true; text: "−"; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.adjustMetronomeBpm(-1) }
                    Button { focusable: true; text: "+"; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.adjustMetronomeBpm(1) }
                    Button {
                        focusable: true
                        text: root.service && root.service.metronomeRunning ? "Mute Click" : "Unmute Click"
                        foreground: Color.foreground
                        accent: Color.accent
                        onClicked: if (root.service) root.service.toggleMetronome()
                    }
                    Item { Layout.fillWidth: true }
                    Text {
                        visible: root.service ? root.service.practiceTimerTotalSeconds > 0 : false
                        text: root.formatSeconds(root.service ? root.service.practiceTimerRemainingSeconds : 0)
                        color: Color.foreground
                        font.family: Style.font.family
                        font.pixelSize: Style.font.title
                        font.bold: true
                    }
                    Button {
                        focusable: true
                        visible: root.service ? root.service.practiceTimerTotalSeconds > 0 : false
                        text: root.service && root.service.practiceTimerRunning ? "Pause" : "Resume"
                        foreground: Color.foreground
                        accent: Color.accent
                        onClicked: {
                            if (!root.service) return
                            if (root.service.practiceTimerRunning) root.service.pausePracticeTimer()
                            else root.service.resumePracticeTimer()
                        }
                    }
                }

                Text {
                    visible: root.service ? root.service.activeNextItem() !== null : false
                    text: root.service && root.service.activeNextItem() ? "Next: " + root.service.activeNextItem().label : ""
                    color: Color.foreground
                    opacity: 0.6
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                }

                // Outcome prompt for a tempo-tracked item, otherwise a plain advance button.
                RowLayout {
                    visible: root.service ? root.service.routineAwaitingOutcome : false
                    spacing: Style.spacing.md
                    Text { text: "How did that go?"; color: Color.foreground; font.family: Style.font.family; font.pixelSize: Style.font.body }
                    Button { focusable: true; text: "Clean"; bordered: true; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.completeRoutineItem("clean") }
                    Button { focusable: true; text: "Nearly"; bordered: true; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.completeRoutineItem("nearly") }
                    Button { focusable: true; text: "Needs Work"; bordered: true; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.completeRoutineItem("needs_work") }
                }
                RowLayout {
                    visible: root.service ? !root.service.routineAwaitingOutcome : true
                    spacing: Style.spacing.md
                    Button {
                        focusable: true
                        text: root.service && root.service.activeNextItem() ? "Next Item" : "Finish"
                        bordered: true
                        foreground: Color.foreground
                        accent: Color.accent
                        onClicked: if (root.service) root.service.requestAdvanceRoutine()
                    }
                    Button { focusable: true; text: "Stop Routine"; bordered: true; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.stopRoutine() }
                }

                Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Color.foreground; opacity: 0.18 }
            }

            ButtonGroup {
                visible: root.service ? !root.service.activeRoutine : true
                Layout.fillWidth: true
                options: [{ value: "presets", label: "Practice Sessions" }, { value: "mine", label: "My Routines" }]
                value: routinesRoot.subMode
                foreground: Color.foreground
                accent: Color.accent
                onChanged: function (value) {
                    if (root.service) root.service.setRoutineBrowserSource(value)
                }
            }

            RowLayout {
                visible: root.service ? !root.service.activeRoutine : true
                Layout.fillWidth: true
                spacing: Style.spacing.md

                Dropdown {
                    Layout.preferredWidth: Style.space(210)
                    Layout.fillWidth: true
                    label: "Category"
                    options: routinesRoot.subMode === "presets"
                        ? ["All"].concat(root.service ? root.service.presetCategories() : []) : ["All"]
                    value: routinesRoot.category
                    enabled: routinesRoot.subMode === "presets"
                    onChanged: function (value) {
                        if (!root.service) return
                        root.service.setRoutineBrowserCategory(value)
                        var filtered = PresetBrowser.filteredPresets(root.service.allPresets(), value)
                        var next = PresetBrowser.selectedRoutine(filtered, root.service.preferences.routinePresetId)
                        root.service.setRoutineBrowserSelection("presets", next ? next.id : "")
                    }
                }

                Dropdown {
                    Layout.preferredWidth: Style.space(560)
                    Layout.fillWidth: true
                    label: "Routine"
                    options: PresetBrowser.routineOptions(routinesRoot.selector.routines)
                    value: routinesRoot.selector.selectedId
                    enabled: routinesRoot.selector.routines.length > 0
                    onChanged: function (value) {
                        if (root.service) root.service.setRoutineBrowserSelection(routinesRoot.subMode, value)
                    }
                }
            }

            // Only one selected routine exists in the content tree. Its content
            // scrolls inside this fixed surface; selectors and actions stay put.
            Rectangle {
                visible: root.service ? !root.service.activeRoutine : true
                Layout.fillWidth: true
                Layout.preferredHeight: Style.space(330)
                color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.025)
                radius: Style.space(6)
                clip: true

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: Style.space(10)
                    spacing: Style.spacing.xs

                    Flickable {
                        id: routineDetailScroll
                        objectName: "routineDetailScroll"
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        contentWidth: width
                        contentHeight: routineDetail.implicitHeight
                        clip: true
                        boundsBehavior: Flickable.StopAtBounds
                        interactive: contentHeight > height

                        ColumnLayout {
                            id: routineDetail
                            width: routineDetailScroll.width - (routineDetailScroll.contentHeight > routineDetailScroll.height ? Style.space(8) : 0)
                            spacing: Style.spacing.xs

                            ColumnLayout {
                                visible: !routinesRoot.editorOpen
                                Layout.fillWidth: true
                                spacing: Style.spacing.xs

                                Text {
                                    Layout.fillWidth: true
                                    text: routinesRoot.chosen ? routinesRoot.chosen.name
                                        : (routinesRoot.subMode === "mine" ? "No saved routines" : "No practice session")
                                    color: Color.foreground
                                    font.family: Style.font.family
                                    font.pixelSize: Style.font.heading
                                    font.bold: true
                                    wrapMode: Text.WordWrap
                                }
                                Text {
                                    Layout.fillWidth: true
                                    text: routinesRoot.chosen
                                        ? (routinesRoot.subMode === "presets" ? routinesRoot.chosen.category : "My Routine") : ""
                                    color: Color.accent
                                    font.family: Style.font.family
                                    font.pixelSize: Style.font.caption
                                    font.bold: true
                                }

                                GridLayout {
                                    visible: !!routinesRoot.chosen
                                    Layout.fillWidth: true
                                    columns: 3
                                    columnSpacing: Style.spacing.md
                                    rowSpacing: Style.spacing.xxs
                                    Text {
                                        text: "BPM  " + routinesRoot.suggestedBpm(routinesRoot.selectedItem)
                                        color: Color.foreground; opacity: 0.72
                                        font.family: Style.font.family; font.pixelSize: Style.font.caption
                                    }
                                    Text {
                                        text: "Duration  " + (routinesRoot.chosen ? PresetBrowser.totalMinutes(routinesRoot.chosen) : 0) + " min"
                                        color: Color.foreground; opacity: 0.72
                                        font.family: Style.font.family; font.pixelSize: Style.font.caption
                                    }
                                    Text {
                                        text: "Click  " + routinesRoot.metronomeSummary(routinesRoot.selectedItem)
                                        color: Color.foreground; opacity: 0.72
                                        font.family: Style.font.family; font.pixelSize: Style.font.caption
                                        elide: Text.ElideRight
                                    }
                                }

                                PracticeVisual {
                                    visible: !!routinesRoot.selectedItem && !!routinesRoot.selectedItem.visualAid
                                    Layout.fillWidth: true
                                    item: routinesRoot.selectedItem
                                    board: root.previewBoard(routinesRoot.selectedItem)
                                    stringLabels: root.previewStringLabels(routinesRoot.selectedItem)
                                    toneData: root.previewToneData(routinesRoot.selectedItem)
                                    voicings: root.previewVoicings(routinesRoot.selectedItem)
                                    fretWindow: root.previewFretWindow(routinesRoot.selectedItem)
                                    showFretboard: root.previewShowsFretboard(routinesRoot.selectedItem)
                                    showChord: root.previewShowsChordDiagram(routinesRoot.selectedItem)
                                }
                                Text {
                                    visible: !!routinesRoot.selectedItem && !routinesRoot.selectedItem.visualAid
                                    Layout.fillWidth: true
                                    text: "This custom item has no saved visual aid."
                                    color: Color.foreground; opacity: 0.5
                                    font.family: Style.font.family; font.pixelSize: Style.font.caption
                                }
                                Text {
                                    visible: !!routinesRoot.chosen
                                    Layout.fillWidth: true
                                    wrapMode: Text.WordWrap
                                    text: routinesRoot.chosen ? (routinesRoot.chosen.description ||
                                        (routinesRoot.chosen.items.length + " practice item" + (routinesRoot.chosen.items.length === 1 ? "" : "s"))) :
                                        "Duplicate a built-in Practice Session to create a routine with its verified visual data."
                                    color: Color.foreground
                                    opacity: 0.76
                                    font.family: Style.font.family
                                    font.pixelSize: Style.font.body
                                }
                                Text {
                                    visible: routinesRoot.selectedItem ? routinesRoot.selectedItem.notes !== "" : false
                                    Layout.fillWidth: true
                                    wrapMode: Text.WordWrap
                                    text: routinesRoot.selectedItem ? routinesRoot.selectedItem.notes : ""
                                    color: Color.foreground
                                    opacity: 0.64
                                    font.family: Style.font.family
                                    font.pixelSize: Style.font.caption
                                }
                                Text {
                                    visible: routinesRoot.chosen ? routinesRoot.chosen.items.length > 1 : false
                                    Layout.fillWidth: true
                                    wrapMode: Text.WordWrap
                                    text: routinesRoot.chosen ? "Routine order: "
                                        + routinesRoot.chosen.items.map(function (item) { return item.label }).join(" → ") : ""
                                    color: Color.foreground
                                    opacity: 0.58
                                    font.family: Style.font.family
                                    font.pixelSize: Style.font.caption
                                }
                            }

                            ColumnLayout {
                                visible: routinesRoot.editorOpen
                                Layout.fillWidth: true
                                spacing: Style.spacing.sm
                                PanelSectionHeader { text: "Edit My Routine" }
                                TextField {
                                    Layout.fillWidth: true
                                    placeholderText: "Routine name"
                                    text: routinesRoot.editorName
                                    onTextChanged: routinesRoot.editorName = text
                                }
                                Text {
                                    Layout.fillWidth: true
                                    text: "Reorder or remove items. Existing verified visual data stays attached to each item."
                                    wrapMode: Text.WordWrap
                                    color: Color.foreground; opacity: 0.62
                                    font.family: Style.font.family; font.pixelSize: Style.font.caption
                                }
                                Repeater {
                                    model: routinesRoot.editorItems
                                    delegate: RowLayout {
                                        id: editorItemRow
                                        required property var modelData
                                        required property int index
                                        Layout.fillWidth: true
                                        Text {
                                            Layout.fillWidth: true
                                            text: (editorItemRow.index + 1) + ". " + editorItemRow.modelData.label
                                            elide: Text.ElideRight
                                            color: Color.foreground
                                            font.family: Style.font.family
                                            font.pixelSize: Style.font.body
                                        }
                                        Button { focusable: true; text: "↑"; foreground: Color.foreground; accent: Color.accent; onClicked: routinesRoot.editorItems = root.moveItem(routinesRoot.editorItems, editorItemRow.index, editorItemRow.index - 1) }
                                        Button { focusable: true; text: "↓"; foreground: Color.foreground; accent: Color.accent; onClicked: routinesRoot.editorItems = root.moveItem(routinesRoot.editorItems, editorItemRow.index, editorItemRow.index + 1) }
                                        Button { focusable: true; text: "Remove"; foreground: Color.foreground; accent: Color.accent; onClicked: routinesRoot.editorItems = routinesRoot.editorItems.filter(function (_, itemIndex) { return itemIndex !== editorItemRow.index }) }
                                    }
                                }
                            }
                        }

                        Rectangle {
                            visible: routineDetailScroll.contentHeight > routineDetailScroll.height
                            anchors.right: parent.right
                            width: Style.space(3)
                            radius: width / 2
                            color: Color.accent
                            opacity: 0.55
                            height: Math.max(Style.space(22), parent.height * parent.height / parent.contentHeight)
                            y: parent.contentY * (parent.height - height) / Math.max(1, parent.contentHeight - parent.height)
                        }
                    }

                    RowLayout {
                        visible: routinesRoot.editorOpen
                        Layout.fillWidth: true
                        Item { Layout.fillWidth: true }
                        Button { focusable: true; text: "Cancel"; foreground: Color.foreground; accent: Color.accent; onClicked: routinesRoot.cancelEdit() }
                        Button {
                            focusable: true; text: "Save Changes"; bordered: true
                            foreground: Color.foreground; accent: Color.accent
                            enabled: routinesRoot.editorName.trim().length > 0 && routinesRoot.editorItems.length > 0
                            onClicked: routinesRoot.saveEdit()
                        }
                    }

                    RowLayout {
                        visible: !routinesRoot.editorOpen && !!routinesRoot.chosen
                        Layout.fillWidth: true
                        Item { Layout.fillWidth: true }
                        Button {
                            visible: routinesRoot.subMode === "mine"
                            focusable: true; text: "Edit"
                            foreground: Color.foreground; accent: Color.accent
                            onClicked: routinesRoot.beginEdit()
                        }
                        Button {
                            focusable: true
                            text: routinesRoot.subMode === "presets" ? "Duplicate to My Routines" : "Duplicate"
                            foreground: Color.foreground; accent: Color.accent
                            onClicked: routinesRoot.duplicateSelected()
                        }
                        Button {
                            visible: routinesRoot.subMode === "mine"
                            focusable: true; text: "Delete"
                            foreground: Color.foreground; accent: Color.accent
                            onClicked: routinesRoot.deleteSelected()
                        }
                        Button {
                            focusable: true; text: "Start Practice"; bordered: true
                            foreground: Color.foreground; accent: Color.accent
                            onClicked: {
                                if (!root.service || !routinesRoot.chosen) return
                                if (routinesRoot.subMode === "mine") root.service.startRoutine(routinesRoot.chosen.id)
                                else root.service.startPreset(routinesRoot.chosen.id)
                            }
                        }
                    }
                }
            }
        }
    }

    function moveItem(items, from, to) {
        if (to < 0 || to >= items.length) return items
        var copy = items.slice()
        var moved = copy.splice(from, 1)[0]
        copy.splice(to, 0, moved)
        return copy
    }
}
