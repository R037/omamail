import QtQuick
import QtQuick.Controls as QQC
import qs.Commons
import qs.Ui
import "../account/Model.js" as Model
import "Menu.js" as Menu

// Which of the user's labels a message carries. Opened on `l`, and from the
// row's menu.
//
// One field and one list. Typing narrows the list to the labels whose name
// contains the text; Enter puts the highlighted one on the message or takes
// it off, and the sheet stays up so several can be changed in one visit.
// When the text names no label, the first row offers to make one — so a
// name that exists is chosen by typing it and a name that does not is
// created by typing it, with no mode to switch between.
Item {
  id: root

  required property var service
  required property color textColor
  required property color accentColor
  required property color dimColor
  required property color popupBackgroundColor
  required property color popupBorderColor
  required property string panelFontFamily

  readonly property bool opened: menu.opened

  property string messageId: ""
  property int cursorIndex: 0
  property bool creating: false

  signal toggled(string id, string labelId, bool on)
  signal createRequested(string id, string name)

  anchors.fill: parent
  z: 45

  // Read off the list rather than copied in, so a label just put on shows
  // its check the moment the row is updated.
  readonly property var summary: {
    if (!service || messageId === "") return null
    var list = service.messages
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === messageId) return list[i]
    }
    return null
  }
  readonly property var choices: Model.labelChoices(
    service ? service.labels : [], summary ? summary.labelIds : [], field.text)

  function openFor(id) {
    messageId = String(id || "")
    creating = false
    field.text = ""
    cursorIndex = 0
    anchorX = Math.max(0, (root.width - menu.width) / 2)
    anchorY = Math.max(0, (root.height - menu.implicitHeight) / 2)
    menu.open()
    place()
  }

  function close() { menu.close() }

  property real anchorX: 0
  property real anchorY: 0

  function place() {
    if (!menu.visible) return
    var tall = menu.height > 0 ? menu.height : menu.implicitHeight
    var placed = Menu.position(anchorX, anchorY, menu.width, tall, root.width, root.height)
    menu.x = placed.x
    menu.y = placed.y
  }

  function moveCursor(delta) {
    var count = root.choices.length
    if (count === 0) return
    cursorIndex = Model.wrappedIndex(cursorIndex, delta, count)
  }

  function activate(index) {
    var choice = root.choices[index]
    if (!choice) return
    if (choice.kind === "create") {
      if (creating) return
      creating = true
      root.createRequested(root.messageId, choice.name)
      return
    }
    root.toggled(root.messageId, choice.id, !choice.on)
  }

  // The name that was being typed becomes a label the message now has, so
  // the text has done its job: clear it, and the list is whole again with
  // the new label checked at the top.
  function created() {
    creating = false
    field.text = ""
    cursorIndex = 0
  }

  function createFailed() {
    creating = false
  }

  // A shorter list than the cursor was standing in leaves it on the last row
  // rather than on nothing.
  onChoicesChanged: if (cursorIndex >= choices.length) cursorIndex = Math.max(0, choices.length - 1)

  QQC.Popup {
    id: menu
    width: Style.space(300)
    implicitHeight: rows.implicitHeight + Style.space(8)
    padding: Style.space(4)
    modal: false
    focus: true
    closePolicy: QQC.Popup.CloseOnEscape | QQC.Popup.CloseOnPressOutside
    onHeightChanged: root.place()
    onOpened: {
      root.place()
      field.forceActiveFocus()
    }
    background: Rectangle {
      radius: Style.cornerRadius
      color: root.popupBackgroundColor
      border.width: 1
      border.color: root.popupBorderColor
    }

    contentItem: Column {
      id: rows
      spacing: Style.space(2)

      Item {
        width: menu.width - menu.leftPadding - menu.rightPadding
        implicitHeight: heading.implicitHeight + Style.space(10)

        Column {
          id: heading
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.leftMargin: Style.space(9)
          anchors.rightMargin: Style.space(9)
          anchors.verticalCenter: parent.verticalCenter
          spacing: Style.space(1)

          Text {
            width: parent.width
            textFormat: Text.PlainText
            text: "Labels"
            color: root.dimColor
            font.family: root.panelFontFamily
            font.pixelSize: Style.font.caption
            elide: Text.ElideRight
          }
          Text {
            width: parent.width
            textFormat: Text.PlainText
            text: root.summary ? (root.summary.subject !== "" ? root.summary.subject : "(no subject)") : ""
            color: root.textColor
            font.family: root.panelFontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: true
            elide: Text.ElideRight
          }
        }
      }

      Item {
        width: menu.width - menu.leftPadding - menu.rightPadding
        implicitHeight: field.implicitHeight + Style.space(6)

        TextField {
          id: field
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.leftMargin: Style.space(9)
          anchors.rightMargin: Style.space(9)
          anchors.verticalCenter: parent.verticalCenter
          foreground: root.textColor
          accent: root.accentColor
          placeholderText: "Find or create a label"
          font.family: root.panelFontFamily
          font.pixelSize: Style.font.bodySmall
          onTextChanged: root.cursorIndex = 0

          // The field owns the keyboard, and takes a key before its parents
          // do, so the list's own keys are read here. Arrows rather than
          // j/k: those are letters in a label's name.
          Keys.onPressed: function(event) {
            if (event.key === Qt.Key_Down) { root.moveCursor(1); event.accepted = true }
            else if (event.key === Qt.Key_Up) { root.moveCursor(-1); event.accepted = true }
            else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
              root.activate(root.cursorIndex); event.accepted = true
            }
          }
        }
      }

      Repeater {
        model: root.choices

        Rectangle {
          id: row
          required property var modelData
          required property int index

          readonly property bool hasCursor: root.cursorIndex === row.index

          width: menu.width - menu.leftPadding - menu.rightPadding
          implicitHeight: Style.spacing.popupRowHeight
          radius: Style.cornerRadius
          color: rowHover.hovered || hasCursor
            ? Style.hoverFillFor(root.textColor, root.accentColor) : "transparent"
          border.width: hasCursor ? Style.normalBorderWidth : 0
          border.color: Style.hoverBorderFor(root.textColor, root.accentColor)

          ActionIcon {
            id: mark
            anchors.left: parent.left
            anchors.leftMargin: Style.space(9)
            anchors.verticalCenter: parent.verticalCenter
            name: row.modelData.kind === "create" ? "plus" : "check"
            iconSize: Style.font.iconSmall
            color: row.modelData.kind === "create" ? root.accentColor : root.textColor
            visible: row.modelData.kind === "create" || row.modelData.on
          }

          Text {
            anchors.left: parent.left
            anchors.leftMargin: Style.space(9) + Style.font.iconSmall + Style.space(8)
            anchors.right: parent.right
            anchors.rightMargin: Style.space(9)
            anchors.verticalCenter: parent.verticalCenter
            textFormat: Text.PlainText
            text: row.modelData.kind === "create"
              ? (root.creating ? "Creating \"" + row.modelData.name + "\"..." : "Create \"" + row.modelData.name + "\"")
              : row.modelData.name
            color: row.modelData.kind === "create" ? root.accentColor : root.textColor
            font.family: root.panelFontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: row.modelData.on
            elide: Text.ElideRight
          }

          HoverHandler { id: rowHover }
          TapHandler { onTapped: root.activate(row.index) }
        }
      }

      Item {
        visible: root.choices.length === 0
        width: menu.width - menu.leftPadding - menu.rightPadding
        implicitHeight: Style.spacing.popupRowHeight

        Text {
          anchors.left: parent.left
          anchors.leftMargin: Style.space(9)
          anchors.verticalCenter: parent.verticalCenter
          textFormat: Text.PlainText
          text: "No labels yet — type a name to make one"
          color: root.dimColor
          font.family: root.panelFontFamily
          font.pixelSize: Style.font.caption
        }
      }
    }
  }
}
