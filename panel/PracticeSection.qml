pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "../js/metronome.js" as Metronome
import "../js/routines.js" as Routines
import "../js/exercises.js" as Exercises
import "../js/theory.js" as Theory
import "../js/fretboard.js" as Fretboard
import "../js/chord_voicings.js" as Voicings

Item {
    id: root
    property var service: null
    property var bar: null
    property string mode: "metronome" // metronome | routines | trainer | timer

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
        if (!tones) return null
        var tuning = root.service.currentTuning()
        var board = Fretboard.buildFretboard(tuning.notes, root.service.fretCount)
        return Fretboard.highlightFretboard(board, Theory.pitchClassSet(tones.notes), tones.rootPitchClass)
    }

    function previewVoicings(item) {
        if (!root.service || !item || !item.chordKey) return []
        var tuning = root.service.currentTuning()
        var chord = Theory.buildChord(item.chordKey.key, item.chordKey.chordId)
        if (!chord) return []
        return Voicings.findVoicings(tuning.notes, Theory.pitchClassSet(chord.notes), chord.rootPitchClass)
    }

    function previewFretWindow(item) {
        if (!root.service || !item) return null
        if (item.fretWindow) return { startFret: item.fretWindow[0], endFret: item.fretWindow[1] }
        var tones = previewToneData(item)
        if (!tones) return null
        return Fretboard.findPositionWindow(root.service.currentTuning().notes, Theory.pitchClassSet(tones.notes), root.service.fretCount, 5)
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
            property string subMode: "presets" // presets | mine
            property string selectedPresetId: ""

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

                // Pattern/sequence text, when the item has one.
                ColumnLayout {
                    visible: root.service && root.service.activeItem() && root.service.activeItem().pattern
                    spacing: Style.spacing.xxs
                    Repeater {
                        model: root.service && root.service.activeItem() && root.service.activeItem().pattern ? root.service.activeItem().pattern : []
                        delegate: Text {
                            required property string modelData
                            text: "•  " + modelData
                            color: Color.foreground
                            opacity: 0.85
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                        }
                    }
                }

                // Visual aid: whatever the current item is actually about.
                FretboardGrid {
                    visible: root.service ? !!root.service.currentToneData() : false
                    Layout.fillWidth: true
                    board: root.service ? root.service.currentFretboard() : null
                    stringLabels: root.stringLabelsFor(root.service)
                    showIntervals: root.service ? root.service.showIntervals : false
                    toneData: root.service ? root.service.currentToneData() : null
                    startFret: root.service && root.service.activeItemFretWindow() ? root.service.activeItemFretWindow().startFret : 0
                    endFret: root.service && root.service.activeItemFretWindow() ? root.service.activeItemFretWindow().endFret : -1
                }
                RowLayout {
                    visible: root.service ? root.service.referenceMode === "chord" : false
                    spacing: Style.spacing.lg
                    Repeater {
                        model: root.service ? root.service.currentChordVoicings() : []
                        delegate: ChordDiagram {
                            required property var modelData
                            voicing: modelData
                        }
                    }
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
                Layout.fillWidth: true
                options: [{ value: "presets", label: "Practice Sessions" }, { value: "mine", label: "My Routines" }]
                value: routinesRoot.subMode
                foreground: Color.foreground
                accent: Color.accent
                onChanged: function (value) { routinesRoot.subMode = value }
            }

            Loader {
                Layout.fillWidth: true
                sourceComponent: routinesRoot.subMode === "mine" ? myRoutinesView : presetsView
            }

            // ---- presets browser ----
            Component {
                id: presetsView
                ColumnLayout {
                    width: layout.width
                    spacing: Style.spacing.md
                    property string category: "All"

                    ButtonGroup {
                        Layout.fillWidth: true
                        options: ["All"].concat(root.service ? root.service.presetCategories() : [])
                        value: category
                        foreground: Color.foreground
                        accent: Color.accent
                        onChanged: function (value) { category = value }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: Style.spacing.xs
                        Repeater {
                            model: {
                                var all = root.service ? root.service.allPresets() : []
                                return category === "All" ? all : all.filter(function (p) { return p.category === category })
                            }
                            delegate: ColumnLayout {
                                required property var modelData
                                Layout.fillWidth: true
                                spacing: Style.spacing.xxs

                                RowLayout {
                                    Layout.fillWidth: true
                                    spacing: Style.spacing.sm
                                    Button {
                                        focusable: true
                                        text: modelData.name
                                        leftAlign: true
                                        Layout.fillWidth: true
                                        foreground: Color.foreground
                                        accent: Color.accent
                                        selected: routinesRoot.selectedPresetId === modelData.id
                                        onClicked: routinesRoot.selectedPresetId = (routinesRoot.selectedPresetId === modelData.id ? "" : modelData.id)
                                    }
                                    Text { text: modelData.category; color: Color.foreground; opacity: 0.5; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                                    Button { focusable: true; text: "Start"; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.startPreset(modelData.id) }
                                    Button {
                                        focusable: true
                                        text: "Duplicate"
                                        foreground: Color.foreground
                                        accent: Color.accent
                                        onClicked: if (root.service) { root.service.duplicatePreset(modelData.id); routinesRoot.subMode = "mine" }
                                    }
                                }

                                ColumnLayout {
                                    visible: routinesRoot.selectedPresetId === modelData.id
                                    Layout.fillWidth: true
                                    Layout.leftMargin: Style.space(12)
                                    Layout.bottomMargin: Style.space(8)
                                    spacing: Style.spacing.xs

                                    Text {
                                        Layout.fillWidth: true
                                        wrapMode: Text.WordWrap
                                        text: modelData.description
                                        color: Color.foreground
                                        opacity: 0.75
                                        font.family: Style.font.family
                                        font.pixelSize: Style.font.body
                                    }
                                    Text {
                                        Layout.fillWidth: true
                                        wrapMode: Text.WordWrap
                                        visible: modelData.items[0].notes !== ""
                                        text: modelData.items[0].notes
                                        color: Color.foreground
                                        opacity: 0.6
                                        font.family: Style.font.family
                                        font.pixelSize: Style.font.caption
                                    }
                                    Text {
                                        visible: modelData.items.length > 1
                                        text: "Sequence: " + modelData.items.map(function (i) { return i.label }).join(" → ")
                                        color: Color.foreground
                                        opacity: 0.6
                                        font.family: Style.font.family
                                        font.pixelSize: Style.font.caption
                                        wrapMode: Text.WordWrap
                                        Layout.fillWidth: true
                                    }
                                    ColumnLayout {
                                        visible: !!modelData.items[0].pattern
                                        spacing: Style.spacing.xxs
                                        Repeater {
                                            model: modelData.items[0].pattern || []
                                            delegate: Text {
                                                required property string modelData
                                                text: "•  " + modelData
                                                color: Color.foreground
                                                opacity: 0.7
                                                font.family: Style.font.family
                                                font.pixelSize: Style.font.caption
                                            }
                                        }
                                    }

                                    FretboardGrid {
                                        visible: !!root.previewToneData(modelData.items[0])
                                        Layout.fillWidth: true
                                        Layout.preferredHeight: Style.space(160)
                                        board: root.previewBoard(modelData.items[0])
                                        stringLabels: root.stringLabelsFor(root.service)
                                        toneData: root.previewToneData(modelData.items[0])
                                        startFret: root.previewFretWindow(modelData.items[0]) ? root.previewFretWindow(modelData.items[0]).startFret : 0
                                        endFret: root.previewFretWindow(modelData.items[0]) ? root.previewFretWindow(modelData.items[0]).endFret : -1
                                    }
                                    RowLayout {
                                        visible: !!modelData.items[0].chordKey
                                        spacing: Style.spacing.lg
                                        Repeater {
                                            model: root.previewVoicings(modelData.items[0])
                                            delegate: ChordDiagram {
                                                required property var modelData
                                                voicing: modelData
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ---- my routines (build + manage) ----
            Component {
                id: myRoutinesView
                ColumnLayout {
                    width: layout.width
                    spacing: Style.spacing.md

                    PanelSectionHeader { text: "Your Routines" }
                    Repeater {
                        model: root.service ? root.service.routines : []
                        delegate: RowLayout {
                            required property var modelData
                            Layout.fillWidth: true
                            spacing: Style.spacing.sm
                            Text {
                                Layout.fillWidth: true
                                text: modelData.name + "  ·  " + modelData.items.length + " items"
                                color: Color.foreground
                                font.family: Style.font.family
                                font.pixelSize: Style.font.body
                            }
                            Button { focusable: true; text: "Start"; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.startRoutine(modelData.id) }
                            Button { focusable: true; text: "Duplicate"; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.duplicateRoutineById(modelData.id) }
                            Button { focusable: true; text: "Delete"; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.deleteRoutine(modelData.id) }
                        }
                    }
                    Text {
                        visible: root.service ? root.service.routines.length === 0 : true
                        text: "No routines yet. Duplicate a practice session from the Practice Sessions tab, or build one below."
                        color: Color.foreground
                        opacity: 0.5
                        font.family: Style.font.family
                        font.pixelSize: Style.font.caption
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }

                    Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Color.foreground; opacity: 0.18 }

                    PanelSectionHeader { text: "Build a Routine" }
                    RowLayout {
                        spacing: Style.spacing.md
                        TextField { id: newRoutineName; Layout.fillWidth: true; placeholderText: "Routine name" }
                    }

                    ColumnLayout {
                        id: draftItems
                        property var items: []
                        spacing: Style.spacing.xs

                        Repeater {
                            model: draftItems.items
                            delegate: RowLayout {
                                required property var modelData
                                required property int index
                                Layout.fillWidth: true
                                Text { Layout.fillWidth: true; text: (index + 1) + ". " + modelData.label + " (" + modelData.type + ")"; color: Color.foreground; font.family: Style.font.family; font.pixelSize: Style.font.body }
                                Button { focusable: true; text: "↑"; foreground: Color.foreground; accent: Color.accent; onClicked: draftItems.items = root.moveItem(draftItems.items, index, index - 1) }
                                Button { focusable: true; text: "↓"; foreground: Color.foreground; accent: Color.accent; onClicked: draftItems.items = root.moveItem(draftItems.items, index, index + 1) }
                                Button { focusable: true; text: "Remove"; foreground: Color.foreground; accent: Color.accent; onClicked: draftItems.items = draftItems.items.filter(function (_, i) { return i !== index }) }
                            }
                        }
                    }

                    RowLayout {
                        spacing: Style.spacing.md
                        Dropdown {
                            id: presetPicker
                            label: "Preset"
                            options: [{ value: "", label: "Custom" }].concat(Exercises.BUILTIN_EXERCISES.map(function (e) { return { value: e.id, label: e.name } }))
                            value: ""
                            onChanged: function (value) { presetPicker.value = value }
                        }
                        Dropdown {
                            id: typePicker
                            label: "Type"
                            options: Routines.ITEM_TYPES.map(function (t) { return { value: t, label: t.replace(/_/g, " ") } })
                            value: "custom"
                            onChanged: function (value) { typePicker.value = value }
                        }
                        TextField { id: itemLabel; placeholderText: "Item label, e.g. Warmup" }
                        NumberField { id: itemMinutes; label: "Minutes"; value: 5; from: 0; to: 120 }
                        NumberField { id: itemTargetBpm; label: "Target BPM"; value: 0; from: 0; to: 300 }
                    }
                    RowLayout {
                        Button {
                            focusable: true
                            text: "Add Item"
                            bordered: true
                            foreground: Color.foreground
                            accent: Color.accent
                            onClicked: {
                                var preset = presetPicker.value ? Exercises.builtinExerciseById(presetPicker.value) : null
                                draftItems.items = draftItems.items.concat([{
                                    type: preset ? preset.type : typePicker.value,
                                    label: itemLabel.text || (preset ? preset.name : "Practice item"),
                                    durationMinutes: itemMinutes.value || null,
                                    targetBpm: itemTargetBpm.value || (preset ? preset.targetBpm : null),
                                    metronome: preset ? { startBpm: preset.startBpm } : null,
                                    scaleKey: preset && preset.scaleId ? { key: root.service ? root.service.referenceKey : "C", scaleId: preset.scaleId } : null,
                                    notes: ""
                                }])
                                itemLabel.text = ""
                            }
                        }
                        Button {
                            focusable: true
                            text: "Save Routine"
                            bordered: true
                            foreground: Color.foreground
                            accent: Color.accent
                            enabled: newRoutineName.text.length > 0 && draftItems.items.length > 0
                            onClicked: {
                                if (root.service) root.service.createRoutine(newRoutineName.text, draftItems.items)
                                newRoutineName.text = ""
                                draftItems.items = []
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
