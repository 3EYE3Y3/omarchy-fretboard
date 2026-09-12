pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons

// A read-only, generic fretboard diagram: fret numbers along the top,
// string names down the left, and highlighted cells (root distinct from
// other scale/chord tones) from a board already produced by
// js/fretboard.js's buildFretboard/highlightFretboard. Shared by
// ReferenceSection and the Routines visual aid so neither hand-rolls its
// own copy of the grid.
Flickable {
    id: root
    property var board: null          // { fretCount, strings: [...] } from Fretboard.highlightFretboard
    property var stringLabels: []     // display order high-to-low, e.g. tuning notes reversed
    property bool showIntervals: false
    property var toneData: null       // { notes: [{pitchClass, interval}] } for interval lookup
    property int startFret: 0
    property int endFret: -1          // -1 = show the whole board
    property bool showSequence: true
    property bool allowScroll: false
    property real maximumCellSize: Style.space(34)

    readonly property int stringCount: board ? board.strings.length : 0
    readonly property int firstFret: board ? Math.max(0, Math.min(startFret, board.fretCount)) : 0
    readonly property int lastFret: board ? Math.max(firstFret, Math.min(endFret >= 0 ? endFret : board.fretCount, board.fretCount)) : 0
    readonly property real labelWidth: Style.space(22)
    readonly property real cellSize: allowScroll ? maximumCellSize
        : Math.min(maximumCellSize, Math.max(Style.space(18),
            (width - labelWidth) / Math.max(1, lastFret - firstFret + 1)))

    contentWidth: grid.width
    contentHeight: height
    clip: true
    boundsBehavior: Flickable.StopAtBounds
    interactive: allowScroll
    implicitHeight: grid.height + Style.space(14)

    function intervalFor(pitchClass) {
        if (!toneData) return ""
        for (var i = 0; i < toneData.notes.length; i++) if (toneData.notes[i].pitchClass === pitchClass) return toneData.notes[i].interval
        return ""
    }

    function nameFor(pitchClass, fallback) {
        if (!toneData) return fallback
        for (var i = 0; i < toneData.notes.length; i++) if (toneData.notes[i].pitchClass === pitchClass) return toneData.notes[i].name
        return fallback
    }

    function hasEmphasis() {
        if (!board) return false
        for (var s = 0; s < board.strings.length; s++)
            for (var f = firstFret; f <= lastFret; f++)
                if (board.strings[s][f] && board.strings[s][f].isEmphasized) return true
        return false
    }

    Column {
        id: grid
        y: Style.space(5)
        spacing: 0

        Row {
            width: (root.lastFret - root.firstFret + 1) * root.cellSize + root.labelWidth
            height: root.cellSize * 0.6
            spacing: 0
            Item { width: root.labelWidth; height: root.cellSize * 0.6 }
            Repeater {
                model: Math.max(0, root.lastFret - root.firstFret + 1)
                delegate: Text {
                    required property int index
                    width: root.cellSize
                    height: root.cellSize * 0.6
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    text: root.firstFret + index
                    color: Color.foreground
                    opacity: 0.45
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                }
            }
        }

        Repeater {
            model: root.stringCount
            delegate: Row {
                required property int index
                readonly property int stringIndex: root.stringCount - 1 - index // highest string on top
                readonly property var cells: root.board ? root.board.strings[stringIndex].slice(root.firstFret, root.lastFret + 1) : []
                height: root.cellSize
                spacing: 0

                Text {
                    visible: root.stringLabels.length > 0
                    width: root.labelWidth
                    height: root.cellSize
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    text: root.stringLabels.length > stringIndex ? root.stringLabels[stringIndex] : ""
                    color: Color.foreground
                    opacity: 0.6
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                    font.bold: true
                }

                Repeater {
                    model: parent.cells
                    delegate: Rectangle {
                        required property var modelData
                        required property int index
                        width: root.cellSize
                        height: root.cellSize
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
                            width: root.cellSize * 0.72
                            height: width
                            radius: width / 2
                            color: modelData.isRoot ? Color.accent : Color.foreground
                            opacity: {
                                if (!root.hasEmphasis()) return modelData.isRoot ? 1 : 0.55
                                if (modelData.isEmphasized) return modelData.isRoot ? 1 : 0.78
                                return modelData.isRoot ? 0.42 : 0.18
                            }
                            border.width: modelData.isEmphasized ? Math.max(1, Style.space(2)) : 0
                            border.color: modelData.isRoot ? Color.foreground : Color.accent
                        }

                        Text {
                            visible: modelData.highlighted
                            anchors.centerIn: parent
                            text: root.showIntervals ? root.intervalFor(modelData.pitchClass) : root.nameFor(modelData.pitchClass, modelData.name)
                            color: Color.background
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                            font.bold: true
                            opacity: !root.hasEmphasis() || modelData.isEmphasized ? 1 : (modelData.isRoot ? 0.78 : 0.48)
                        }

                        Rectangle {
                            visible: root.showSequence && modelData.highlighted && modelData.sequenceIndex > 0
                            anchors.right: parent.right
                            anchors.top: parent.top
                            anchors.margins: 1
                            width: root.cellSize * 0.38
                            height: width
                            radius: width / 2
                            color: Color.accent
                            Text {
                                anchors.centerIn: parent
                                text: modelData.sequenceIndex || ""
                                color: Color.background
                                font.family: Style.font.family
                                font.pixelSize: Math.max(7, root.cellSize * 0.25)
                                font.bold: true
                            }
                        }
                    }
                }
            }
        }
    }
}
