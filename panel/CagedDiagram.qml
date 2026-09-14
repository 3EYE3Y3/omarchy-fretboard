pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons

// A single, large, readable CAGED chord diagram for one transposed shape
// from js/caged_shapes.js's transposeCagedShape(): six strings, fret
// numbers, the nut when the shape sits in open position, a starting-fret
// label for movable shapes, open/muted strings, fretted notes with the
// root visually distinct, a barre bar when the shape requires one, and a
// note-name/interval toggle. This replaces the old small
// Open/E-root/A-root strip for the Chord Reference tab; ChordDiagram.qml
// (used by Practice's routine previews) is untouched.
ColumnLayout {
    id: root
    property var shape: null          // { shape, anchorFret, span, barre, strings:[...] } or null
    property var toneData: null       // { notes: [{pitchClass, name, interval}] } for label lookup
    property bool showIntervals: false

    readonly property real cellSize: Style.space(46)
    readonly property real labelWidth: Style.space(34)
    readonly property int span: root.shape ? Math.max(1, root.shape.span) : 4
    readonly property int barreFromString: barreRange() ? barreRange()[0] : -1
    readonly property int barreToString: barreRange() ? barreRange()[1] : -1

    spacing: Style.spacing.sm

    function nameFor(pitchClass) {
        if (!root.toneData) return ""
        for (var i = 0; i < root.toneData.notes.length; i++) if (root.toneData.notes[i].pitchClass === pitchClass) return root.toneData.notes[i].name
        return ""
    }

    function intervalFor(pitchClass) {
        if (!root.toneData) return ""
        for (var i = 0; i < root.toneData.notes.length; i++) if (root.toneData.notes[i].pitchClass === pitchClass) return root.toneData.notes[i].interval
        return ""
    }

    // Strings sounding exactly at the anchor fret that were open in the
    // shape's reference chord form need one barre finger across them.
    function barreRange() {
        if (!root.shape || !root.shape.barre) return null
        var lo = -1, hi = -1
        for (var i = 0; i < root.shape.strings.length; i++) {
            var s = root.shape.strings[i]
            if (!s.muted && s.fret === root.shape.anchorFret) {
                if (lo < 0) lo = i
                hi = i
            }
        }
        return hi > lo ? [lo, hi] : null
    }

    function rootStringLabel() {
        if (!root.shape) return ""
        var numbers = []
        for (var i = 0; i < root.shape.strings.length; i++) {
            var s = root.shape.strings[i]
            if (!s.muted && s.isRoot) numbers.push(6 - s.stringIndex)
        }
        if (numbers.length === 0) return ""
        var list = numbers.length > 1
            ? numbers.slice(0, -1).join(", ") + " and " + numbers[numbers.length - 1]
            : String(numbers[0])
        return "Root on string" + (numbers.length > 1 ? "s " : " ") + list
    }

    // ---- open/muted markers above the nut/first fret row ----
    Row {
        Layout.alignment: Qt.AlignHCenter
        spacing: 0
        Item { width: root.labelWidth; height: Style.space(20) }
        Repeater {
            model: root.shape ? root.shape.strings.length : 0
            delegate: Text {
                required property int index
                readonly property var stringData: root.shape.strings[index]
                width: root.cellSize
                height: Style.space(20)
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                text: stringData.muted ? "x" : (stringData.fret === 0 ? "o" : "")
                color: Color.foreground
                opacity: stringData.muted ? 0.55 : 0.85
                font.family: Style.font.family
                font.pixelSize: Style.font.subtitle
                font.bold: true
            }
        }
    }

    // ---- the fret grid itself ----
    Item {
        Layout.alignment: Qt.AlignHCenter
        implicitWidth: root.labelWidth + (root.shape ? root.shape.strings.length : 6) * root.cellSize
        implicitHeight: (root.span + 1) * root.cellSize + Style.space(4)

        // Nut: a thick top line, only when the shape is in true open position.
        Rectangle {
            visible: !!root.shape && root.shape.anchorFret === 0
            x: root.labelWidth
            y: 0
            width: parent.width - root.labelWidth
            height: Style.space(4)
            color: Color.foreground
        }

        // Barre bar behind the dots it connects.
        Rectangle {
            visible: root.barreFromString >= 0
            x: root.labelWidth + root.barreFromString * root.cellSize + root.cellSize / 2 - Style.space(10)
            y: Style.space(4) + root.cellSize / 2 - Style.space(10)
            width: (root.barreToString - root.barreFromString) * root.cellSize + Style.space(20)
            height: Style.space(20)
            radius: Style.space(10)
            color: Color.accent
            opacity: 0.32
        }

        Column {
            y: Style.space(4)
            spacing: 0

            Repeater {
                model: root.span + 1
                delegate: Row {
                    id: fretRowItem
                    required property int index
                    readonly property int fretRow: root.shape ? root.shape.anchorFret + index : 0
                    spacing: 0

                    Text {
                        width: root.labelWidth
                        height: root.cellSize
                        horizontalAlignment: Text.AlignRight
                        verticalAlignment: Text.AlignVCenter
                        rightPadding: Style.space(6)
                        text: (fretRowItem.index === 0 && fretRowItem.fretRow > 0) ? (fretRowItem.fretRow + "fr") : ""
                        color: Color.foreground
                        opacity: 0.6
                        font.family: Style.font.family
                        font.pixelSize: Style.font.caption
                        font.bold: true
                    }

                    Repeater {
                        model: root.shape ? root.shape.strings.length : 0
                        delegate: Rectangle {
                            required property int index
                            readonly property var stringData: root.shape.strings[index]
                            readonly property int fretRow: fretRowItem.fretRow
                            width: root.cellSize
                            height: root.cellSize
                            color: "transparent"
                            border.width: 1
                            border.color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.25)

                            // Vertical string line through the middle of the cell.
                            Rectangle {
                                anchors.horizontalCenter: parent.horizontalCenter
                                anchors.top: parent.top
                                anchors.bottom: parent.bottom
                                width: 1
                                color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.18)
                            }

                            Rectangle {
                                visible: !stringData.muted && stringData.fret === fretRow && stringData.fret >= 0
                                    && !(fretRow === root.shape.anchorFret && root.barreFromString >= 0 && index > root.barreFromString && index <= root.barreToString)
                                anchors.centerIn: parent
                                width: root.cellSize * 0.66
                                height: width
                                radius: width / 2
                                color: stringData.isRoot ? Color.accent : Color.foreground
                                border.width: stringData.isRoot ? Style.space(2) : 0
                                border.color: Color.background
                            }

                            // Dot for a barred string, drawn on top of the barre bar.
                            Rectangle {
                                visible: !stringData.muted && stringData.fret === fretRow && root.barreFromString >= 0
                                    && index > root.barreFromString && index <= root.barreToString
                                anchors.centerIn: parent
                                width: root.cellSize * 0.5
                                height: width
                                radius: width / 2
                                color: stringData.isRoot ? Color.accent : Color.foreground
                                opacity: 0.9
                            }

                            Text {
                                visible: !stringData.muted && stringData.fret === fretRow && stringData.fret >= 0
                                anchors.centerIn: parent
                                text: root.showIntervals ? root.intervalFor(stringData.pitchClass) : root.nameFor(stringData.pitchClass)
                                color: Color.background
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

    Text {
        Layout.alignment: Qt.AlignHCenter
        visible: root.rootStringLabel() !== ""
        text: root.rootStringLabel()
        color: Color.foreground
        opacity: 0.6
        font.family: Style.font.family
        font.pixelSize: Style.font.caption
    }
}
