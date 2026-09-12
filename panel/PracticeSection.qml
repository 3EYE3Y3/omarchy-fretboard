pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "../js/metronome.js" as Metronome
import "../js/routines.js" as Routines
import "../js/exercises.js" as Exercises

Item {
    id: root
    property var service: null
    property var bar: null
    property string mode: "metronome" // metronome | trainer | timer | routines

    implicitHeight: layout.implicitHeight
    Layout.fillWidth: true

    readonly property var modeOptions: [
        { value: "metronome", label: "Metronome" },
        { value: "trainer", label: "Tempo Trainer" },
        { value: "timer", label: "Timer" },
        { value: "routines", label: "Routines" }
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
                        "Target " + (root.service ? root.service.tempoTrainerPlan.targetBpm : "") + " BPM"
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

    // ------------------------------------------------------------ routines
    Component {
        id: routinesView
        ColumnLayout {
            width: layout.width
            spacing: Style.spacing.md

            ColumnLayout {
                visible: root.service ? !!root.service.activeRoutine : false
                Layout.fillWidth: true
                spacing: Style.spacing.xs

                PanelSectionHeader { text: "Running: " + (root.service && root.service.activeRoutine ? root.service.activeRoutine.name : "") }
                Text {
                    text: root.service && root.service.activeRun ? "Now: " + (Routines.currentItem(root.service.activeRoutine, root.service.activeRun) || {}).label : ""
                    color: Color.foreground
                    font.family: Style.font.family
                    font.pixelSize: Style.font.subtitle
                    font.bold: true
                }
                Text {
                    text: root.service && root.service.activeRun && Routines.nextItem(root.service.activeRoutine, root.service.activeRun)
                        ? "Next: " + Routines.nextItem(root.service.activeRoutine, root.service.activeRun).label : "Last item"
                    color: Color.foreground
                    opacity: 0.6
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                }
                RowLayout {
                    spacing: Style.spacing.md
                    Button { focusable: true; text: "Next Item"; bordered: true; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.advanceRoutine() }
                    Button { focusable: true; text: "Stop Routine"; bordered: true; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.stopRoutine() }
                }
                Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Color.foreground; opacity: 0.18 }
            }

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
                text: "No routines yet. Build one below."
                color: Color.foreground
                opacity: 0.5
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
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
                            scaleKey: preset && preset.scaleId ? { scaleId: preset.scaleId } : null,
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

    function moveItem(items, from, to) {
        if (to < 0 || to >= items.length) return items
        var copy = items.slice()
        var moved = copy.splice(from, 1)[0]
        copy.splice(to, 0, moved)
        return copy
    }
}
