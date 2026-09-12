pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import "../js/visual_shapes.js" as VisualShapes

// One renderer contract for all built-in practice content. Data chooses the
// visual semantics; presets never select a bespoke QML screen.
ColumnLayout {
    id: root
    property var item: null
    property var board: null
    property var stringLabels: []
    property var toneData: null
    property var voicings: []
    property var fretWindow: null
    property bool showIntervals: false
    property bool showFretboard: false
    property bool showChord: false
    readonly property var aid: item && item.visualAid ? item.visualAid : null
    readonly property bool showsSequence: !!aid && (aid.mode === VisualShapes.RHYTHM_GRID
        || !!aid.steps || (item && item.pattern && item.pattern.length > 0))
    spacing: Style.spacing.xs

    FretboardGrid {
        visible: root.showFretboard
        Layout.fillWidth: true
        board: root.board
        stringLabels: root.stringLabels
        showIntervals: root.showIntervals
        toneData: root.toneData
        maximumCellSize: Style.space(24)
        startFret: root.fretWindow ? root.fretWindow.startFret : 0
        endFret: root.fretWindow ? root.fretWindow.endFret : -1
    }

    RowLayout {
        visible: root.showChord && root.voicings.length > 0
        Layout.fillWidth: true
        spacing: Style.spacing.md
        Repeater {
            model: root.voicings
            delegate: ChordDiagram {
                required property var modelData
                voicing: modelData
            }
        }
    }

    SequenceGrid {
        visible: root.showsSequence
        Layout.fillWidth: true
        preferredColumns: root.aid && root.aid.columns ? root.aid.columns : 8
        steps: {
            if (root.aid && root.aid.steps) return root.aid.steps
            return root.item && root.item.pattern ? root.item.pattern.map(function (p) { return { label: p } }) : []
        }
    }
}
