Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true,
  },
  properties: {
    text: {
      type: String,
      value: 'AI 生成',
    },
    size: {
      type: String,
      value: 'md',
    },
    block: {
      type: Boolean,
      value: false,
    },
    tone: {
      type: String,
      value: 'default',
    },
    icon: {
      type: String,
      value: 'auto_awesome',
    },
    extClass: {
      type: String,
      value: '',
    },
  },
})
