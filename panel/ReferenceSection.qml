pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "../js/tunings.js" as Tunings
import "../js/theory.js" as Theory
import "../js/circle_of_fifths.js" as Circle
import "../js/pitch.js" as Pitch

Item {
    id: root
    property var service: null
    property var bar: null
    property string view: "fretboard" // fretboard | circle | drone

    implicitHeight: layout.implicitHeight
    Layout.fillWidth: true

    readonly property var viewOptions: [
        { value: "fretboard", label: "Fretboard" },
        { value: "circle", label: "Circle of Fifths" },
        { value: "drone", label: "Drone" }
    ]

    readonly property var noteChoices: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    ColumnLayout {
        id: layout
        width: parent.width
        spacing: Style.spacing.md

        ButtonGroup {
            Layout.fillWidth: true
            options: root.viewOptions
            value: root.view
            foreground: Color.foreground
            accent: Color.accent
            onChanged: function (value) { root.view = value }
        }

        Loader {
            Layout.fillWidth: true
            sourceComponent: root.view === "circle" ? circleView : (root.view === "drone" ? droneView : fretboardView)
        }
    }

    // ------------------------------------------------------------ fretboard + scale/chord
    Component {
        id: fretboardView
        ColumnLayout {
            width: layout.width
            spacing: Style.spacing.md

            RowLayout {
                Layout.fillWidth: true
                Dropdown {
                    label: "Tuning"
                    options: root.tuningOptions()
                    value: root.service ? root.service.selectedTuningId : "standard"
                    onChanged: function (value) { if (root.service) root.service.setTuning(value) }
                }
                Dropdown {
                    label: "Key"
                    options: root.noteChoices
                    value: root.service ? root.service.referenceKey : "C"
                    onChanged: function (value) { if (root.service) root.service.setReferenceKey(value) }
                }
                Toggle {
                    label: "Show intervals"
                    description: "Otherwise shows note names"
                    checked: root.service ? root.service.showIntervals : false
                    foreground: Color.foreground
                    accent: Color.accent
                    onClicked: if (root.service) root.service.showIntervals = !root.service.showIntervals
                }
            }

            ButtonGroup {
                Layout.fillWidth: true
                options: [{ value: "scale", label: "Scale" }, { value: "chord", label: "Chord" }]
                value: root.service ? root.service.referenceMode : "scale"
                foreground: Color.foreground
                accent: Color.accent
                onChanged: function (value) {
                    if (!root.service) return
                    if (value === "chord") root.service.setReferenceChord(root.service.referenceChordId)
                    else root.service.setReferenceScale(root.service.referenceScaleId)
                }
            }

            Dropdown {
                visible: root.service ? root.service.referenceMode === "scale" : true
                label: "Scale"
                options: Theory.SCALES.map(function (s) { return { value: s.id, label: s.name } })
                value: root.service ? root.service.referenceScaleId : "major"
                onChanged: function (value) { if (root.service) root.service.setReferenceScale(value) }
            }
            Dropdown {
                visible: root.service ? root.service.referenceMode === "chord" : false
                label: "Chord"
                options: Theory.CHORDS.map(function (c) { return { value: c.id, label: c.name } })
                value: root.service ? root.service.referenceChordId : "major"
                onChanged: function (value) { if (root.service) root.service.setReferenceChord(value) }
            }

            RowLayout {
                visible: !!root.currentTones()
                Layout.fillWidth: true
                spacing: Style.spacing.md
                Text {
                    text: root.currentTones() ? ("Notes: " + root.currentTones().notes.map(function (n) { return n.name }).join(" · ")) : ""
                    color: Color.foreground
                    font.family: Style.font.family
                    font.pixelSize: Style.font.body
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
            }
            Text {
                visible: root.service ? root.service.referenceMode === "chord" : false
                text: root.currentTones() ? ("Formula: " + root.currentTones().formula) : ""
                color: Color.foreground
                opacity: 0.6
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
            }

            Flickable {
                id: fretFlick
                Layout.fillWidth: true
                Layout.preferredHeight: fretGrid.height + Style.space(10)
                contentWidth: fretGrid.width
                contentHeight: height
                clip: true
                boundsBehavior: Flickable.StopAtBounds

                Column {
                    id: fretGrid
                    y: Style.space(5)
                    readonly property int cellSize: Style.space(34)
                    readonly property var board: root.highlightedBoard()
                    readonly property int stringCount: board ? board.strings.length : 0

                    Repeater {
                        model: fretGrid.stringCount
                        delegate: Row {
                            required property int index
                            readonly property int stringIndex: fretGrid.stringCount - 1 - index // highest string on top
                            readonly property var cells: fretGrid.board ? fretGrid.board.strings[stringIndex] : []

                            Repeater {
                                model: parent.cells
                                delegate: Rectangle {
                                    required property var modelData
                                    required property int index
                                    width: fretGrid.cellSize
                                    height: fretGrid.cellSize
                                    color: "transparent"
                                    border.width: 1
                                    border.color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.18)

                                    Rectangle {
                                        visible: [3, 5, 7, 9, 12, 15, 17, 19, 21, 24].indexOf(modelData.fret) >= 0 && parent.index === 0
                                        anchors.centerIn: parent
                                        width: Style.space(4)
                                        height: Style.space(4)
                                        radius: width / 2
                                        color: Color.foreground
                                        opacity: 0.15
                                    }

                                    Rectangle {
                                        visible: modelData.highlighted
                                        anchors.centerIn: parent
                                        width: fretGrid.cellSize * 0.72
                                        height: width
                                        radius: width / 2
                                        color: modelData.isRoot ? Color.accent : Color.foreground
                                        opacity: modelData.isRoot ? 1 : 0.55
                                    }

                                    Text {
                                        visible: modelData.highlighted
                                        anchors.centerIn: parent
                                        text: root.service && root.service.showIntervals ? root.intervalFor(modelData.pitchClass) : modelData.name
                                        color: modelData.isRoot ? Color.background : Color.background
                                        font.family: Style.font.family
                                        font.pixelSize: Style.font.caption
                                        font.bold: true
                                    }
                                }
                            }
                        }
                    }
                }
            }

            ColumnLayout {
                visible: root.service ? root.service.referenceMode === "chord" : false
                Layout.fillWidth: true
                spacing: Style.spacing.sm
                PanelSectionHeader { text: "Voicings" }
                RowLayout {
                    spacing: Style.spacing.lg
                    Repeater {
                        model: root.service ? root.service.currentChordVoicings() : []
                        delegate: ChordDiagram {
                            required property var modelData
                            voicing: modelData
                        }
                    }
                }
            }
        }
    }

    function tuningOptions() {
        var builtins = Tunings.BUILTIN_TUNINGS.map(function (t) { return { value: t.id, label: t.name } })
        var customs = (service ? service.customTunings : []).map(function (t) { return { value: t.id, label: t.name + " (custom)" } })
        return builtins.concat(customs)
    }

    function currentTones() {
        return service ? service.currentToneData() : null
    }

    function highlightedBoard() {
        return service ? service.currentFretboard() : null
    }

    function intervalFor(pitchClass) {
        var tones = currentTones()
        if (!tones) return ""
        for (var i = 0; i < tones.notes.length; i++) if (tones.notes[i].pitchClass === pitchClass) return tones.notes[i].interval
        return ""
    }

    component ChordDiagram: ColumnLayout {
        property var voicing: null
        spacing: Style.spacing.xxs
        readonly property int stringCount: voicing ? voicing.strings.length : 6
        readonly property int span: voicing ? Math.max(1, voicing.span) : 4

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: voicing && voicing.anchorFret > 0 ? (voicing.anchorFret + 1) + "fr" : ""
            visible: voicing ? voicing.anchorFret > 0 : false
            color: Color.foreground
            opacity: 0.6
            font.family: Style.font.family
            font.pixelSize: Style.font.caption
        }

        Row {
            Layout.alignment: Qt.AlignHCenter
            spacing: Style.space(10)
            Repeater {
                model: voicing ? voicing.strings.length : 0
                delegate: Column {
                    required property int index
                    readonly property var stringData: voicing.strings[voicing.strings.length - 1 - index]
                    spacing: Style.space(2)

                    Text {
                        text: stringData.muted ? "x" : (stringData.fret === 0 ? "o" : "")
                        color: Color.foreground
                        font.family: Style.font.family
                        font.pixelSize: Style.font.caption
                        horizontalAlignment: Text.AlignHCenter
                        width: Style.space(16)
                    }
                    Repeater {
                        model: span + 1
                        delegate: Rectangle {
                            required property int index
                            width: Style.space(16)
                            height: Style.space(16)
                            color: "transparent"
                            border.width: 1
                            border.color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.3)
                            Rectangle {
                                visible: !stringData.muted && (stringData.fret - voicing.anchorFret) === index && stringData.fret > 0
                                anchors.centerIn: parent
                                width: Style.space(10)
                                height: width
                                radius: width / 2
                                color: Color.accent
                            }
                        }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------ circle of fifths
    Component {
        id: circleView
        Item {
            width: layout.width
            height: Style.space(320)

            readonly property real centerX: width / 2
            readonly property real centerY: height / 2
            readonly property real radius: Math.min(width, height) / 2 - Style.space(40)

            Repeater {
                model: Circle.KEYS
                delegate: Item {
                    required property var modelData
                    required property int index
                    readonly property real angle: (index * 30 - 90) * Math.PI / 180
                    x: centerX + radius * Math.cos(angle) - width / 2
                    y: centerY + radius * Math.sin(angle) - height / 2
                    width: Style.space(70)
                    height: Style.space(46)

                    ColumnLayout {
                        anchors.centerIn: parent
                        spacing: 0
                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            text: modelData.major
                            color: (root.service && root.service.referenceKey === modelData.major && root.service.referenceScaleId === "major") ? Color.accent : Color.foreground
                            font.family: Style.font.family
                            font.pixelSize: Style.font.subtitle
                            font.bold: true
                            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: if (root.service) root.service.selectCircleKey(modelData, false) }
                        }
                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            text: modelData.minor
                            color: (root.service && root.service.referenceKey + "m" === modelData.minor && root.service.referenceScaleId === "natural_minor") ? Color.accent : Color.foreground
                            opacity: 0.7
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: if (root.service) root.service.selectCircleKey(modelData, true) }
                        }
                    }
                }
            }

            Text {
                anchors.centerIn: parent
                text: root.service ? root.service.referenceKey : ""
                color: Color.foreground
                opacity: 0.25
                font.family: Style.font.family
                font.pixelSize: Style.font.displayLarge
                font.bold: true
            }
        }
    }

    // ------------------------------------------------------------ drone
    Component {
        id: droneView
        ColumnLayout {
            width: layout.width
            spacing: Style.spacing.md

            RowLayout {
                spacing: Style.spacing.md
                Dropdown {
                    label: "Note"
                    options: root.noteChoices
                    value: root.service ? root.service.droneNote : "E"
                    onChanged: function (value) { if (root.service) root.service.setDroneNoteOctave(value, root.service.droneOctave) }
                }
                NumberField {
                    label: "Octave"
                    value: root.service ? root.service.droneOctave : 2
                    from: 0
                    to: 6
                    onModified: function (value) { if (root.service) root.service.setDroneNoteOctave(root.service.droneNote, value) }
                }
            }

            PanelSectionHeader { text: "Volume" }
            PanelSlider {
                Layout.fillWidth: true
                bar: root.bar
                minimum: 0
                maximum: 1
                step: 0.05
                value: root.service ? root.service.metronomeVolume : 0.6
                onMoved: function (value) { if (root.service) root.service.setMetronomeVolume(value) }
            }

            Text {
                text: root.service ? (Pitch.noteToFrequency(root.service.droneNote, root.service.droneOctave, root.service.preferences.a4)).toFixed(2) + " Hz" : ""
                color: Color.foreground
                opacity: 0.6
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
            }

            Button {
                focusable: true
                text: root.service && root.service.droneRunning ? "Stop Drone" : "Play Drone"
                bordered: true
                selected: root.service ? root.service.droneRunning : false
                foreground: Color.foreground
                accent: Color.accent
                onClicked: {
                    if (!root.service) return
                    if (root.service.droneRunning) root.service.stopDrone()
                    else root.service.startDrone()
                }
            }
        }
    }
}
