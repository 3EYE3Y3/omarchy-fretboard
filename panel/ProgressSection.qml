pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "../js/tunings.js" as Tunings

Item {
    id: root
    property var service: null
    property var bar: null
    property string view: "overview" // overview | songs

    implicitHeight: layout.implicitHeight
    Layout.fillWidth: true

    readonly property var viewOptions: [
        { value: "overview", label: "Overview" },
        { value: "songs", label: "Songs" }
    ]

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
            sourceComponent: root.view === "songs" ? songsView : overviewView
        }
    }

    function statTile(label, value) { return { label: label, value: value } }

    function stats() {
        if (!service) return []
        return [
            statTile("Today", service.minutesToday() + " min"),
            statTile("This Week", service.minutesThisWeek() + " min"),
            statTile("Streak", service.currentStreak() + (service.currentStreak() === 1 ? " day" : " days")),
            statTile("Sessions", service.sessionsThisWeek() + " this week"),
            statTile("Total", service.totalPracticeMinutes() + " min")
        ]
    }

    Component {
        id: overviewView
        ColumnLayout {
            width: layout.width
            spacing: Style.spacing.lg

            GridLayout {
                Layout.fillWidth: true
                columns: 5
                columnSpacing: Style.spacing.md
                rowSpacing: Style.spacing.sm

                Repeater {
                    model: root.stats()
                    delegate: ColumnLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: Style.spacing.xxs
                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            text: modelData.value
                            color: Color.accent
                            font.family: Style.font.family
                            font.pixelSize: Style.font.title
                            font.bold: true
                        }
                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            text: modelData.label
                            color: Color.foreground
                            opacity: 0.6
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                        }
                    }
                }
            }

            PanelSectionHeader { text: "Exercise Progress" }
            ColumnLayout {
                Layout.fillWidth: true
                spacing: Style.spacing.xs
                Repeater {
                    model: root.progressRows()
                    delegate: RowLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        Text { Layout.fillWidth: true; text: modelData.name; color: Color.foreground; font.family: Style.font.family; font.pixelSize: Style.font.body }
                        Text { text: "best " + modelData.bestBpm + " BPM"; color: Color.foreground; opacity: 0.7; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                        Text {
                            text: (modelData.improvement >= 0 ? "+" : "") + modelData.improvement + " BPM"
                            color: modelData.improvement > 0 ? Color.accent : Color.foreground
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                            font.bold: true
                        }
                    }
                }
                Text {
                    visible: root.progressRows().length === 0
                    text: "Complete a tracked exercise to see progress here."
                    color: Color.foreground
                    opacity: 0.5
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                }
            }

            PanelSectionHeader { text: "Recent Sessions" }
            ColumnLayout {
                Layout.fillWidth: true
                spacing: Style.spacing.xs
                Repeater {
                    model: root.recentSessions()
                    delegate: RowLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        Text {
                            text: new Date(modelData.startedAt).toLocaleDateString(Qt.locale(), "MMM d")
                            color: Color.foreground
                            opacity: 0.6
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                            Layout.preferredWidth: Style.space(70)
                        }
                        Text {
                            Layout.fillWidth: true
                            text: (modelData.routineName || "Free practice") + "  ·  " + modelData.durationMinutes + " min"
                            color: Color.foreground
                            font.family: Style.font.family
                            font.pixelSize: Style.font.body
                        }
                    }
                }
                Text {
                    visible: root.recentSessions().length === 0
                    text: "No sessions recorded yet."
                    color: Color.foreground
                    opacity: 0.5
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                }
            }
        }
    }

    function progressRows() {
        if (!service) return []
        var rows = []
        var keys = Object.keys(service.exerciseProgress)
        for (var i = 0; i < keys.length; i++) {
            var entry = service.exerciseProgress[keys[i]]
            var exercise = service.allExercises().find(function (e) { return e.id === keys[i] })
            var history = entry.history || []
            var improvement = history.length > 1 ? (history[history.length - 1].bpm - history[0].bpm) : 0
            rows.push({ name: exercise ? exercise.name : keys[i], bestBpm: entry.bestBpm || 0, improvement: improvement })
        }
        return rows
    }

    function recentSessions() {
        if (!service) return []
        return service.sessions.slice().sort(function (a, b) { return b.startedAt - a.startedAt }).slice(0, 8)
    }

    // ------------------------------------------------------------ songs
    Component {
        id: songsView
        ColumnLayout {
            width: layout.width
            spacing: Style.spacing.md

            Repeater {
                model: root.service ? root.service.songs : []
                delegate: RowLayout {
                    required property var modelData
                    Layout.fillWidth: true
                    spacing: Style.spacing.sm
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 0
                        Text { text: modelData.title; color: Color.foreground; font.family: Style.font.family; font.pixelSize: Style.font.body; font.bold: true }
                        Text {
                            text: (modelData.artist || "") + "  ·  " + (modelData.tuning || "standard") + "  ·  " + (modelData.key || "")
                            color: Color.foreground
                            opacity: 0.6
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                        }
                    }
                    NumberField {
                        label: "Current BPM"
                        value: modelData.currentBpm || modelData.originalBpm || 100
                        from: 30
                        to: 300
                        onModified: function (value) { if (root.service) root.service.updateSong(Object.assign({}, modelData, { currentBpm: value })) }
                    }
                    Button { focusable: true; text: "Delete"; foreground: Color.foreground; accent: Color.accent; onClicked: if (root.service) root.service.deleteSong(modelData.id) }
                }
            }
            Text {
                visible: root.service ? root.service.songs.length === 0 : true
                text: "No songs saved yet."
                color: Color.foreground
                opacity: 0.5
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
            }

            Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Color.foreground; opacity: 0.18 }

            PanelSectionHeader { text: "Add a Song" }
            RowLayout {
                spacing: Style.spacing.md
                TextField { id: songTitle; Layout.fillWidth: true; placeholderText: "Title" }
                TextField { id: songArtist; Layout.fillWidth: true; placeholderText: "Artist" }
            }
            RowLayout {
                spacing: Style.spacing.md
                Dropdown {
                    id: songTuning
                    label: "Tuning"
                    options: Tunings.BUILTIN_TUNINGS.map(function (t) { return { value: t.id, label: t.name } })
                    value: "standard"
                    onChanged: function (value) { songTuning.value = value }
                }
                TextField { id: songKey; placeholderText: "Key (e.g. A minor)" }
                NumberField { id: songOriginalBpm; label: "Original BPM"; value: 120; from: 30; to: 300 }
                NumberField { id: songTargetBpm; label: "Target BPM"; value: 120; from: 30; to: 300 }
            }
            Button {
                focusable: true
                text: "Save Song"
                bordered: true
                foreground: Color.foreground
                accent: Color.accent
                enabled: songTitle.text.length > 0
                onClicked: {
                    if (root.service) root.service.createSong({
                        title: songTitle.text, artist: songArtist.text, tuning: songTuning.value,
                        key: songKey.text, originalBpm: songOriginalBpm.value, currentBpm: songOriginalBpm.value,
                        targetBpm: songTargetBpm.value, notes: ""
                    })
                    songTitle.text = ""
                    songArtist.text = ""
                    songKey.text = ""
                }
            }
        }
    }
}
