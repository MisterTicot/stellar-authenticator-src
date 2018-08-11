import * as node from './cosmic-lib/node'
import {timeout} from './cosmic-lib/helpers'

export class Form {
  constructor (element) {
    this.isForm = true
    this.inputs = {}
    this.validators = []

    if (element) {
      if (element.tagName !== 'FORM') throw new Error('Not a form')
      this.node = element
      this.node.autocomplete = 'off'

      for (let index in this.node.childNodes) {
        const child = this.node.childNodes[index]
        if (child.name) this.inputs[child.name] = child
        if (child.className === 'info') this.infoNode = child
      }
    } else {
      this.node = node.create('form', { autocomplete: 'off' })
    }

    if (!this.infoNode) {
      this.infoNode = node.create('span', '.info')
      this.node.insertBefore(this.infoNode, this.firstChild)
    }

    this.node.onsubmit = () => this.submit(this)
  }

  addValidator (thunk) {
    this.validators.push(thunk)
    return this
  }

  reset () {
    this.node.reset()
    this.setError('')
    return this
  }
  submit () {
    validate(this)
    return false
  }

  putInfoNode () {
    node.append(this.node, this.infoNode)
    return this
  }
  async setInfo (info) {
    this.infoNode.textContent = info
    this.infoNode.className = 'info'
    await timeout(30)
    return this
  }
  setError (error) {
    if (error.message) this.infoNode.textContent = error.message
    else this.infoNode.textContent = error
    this.infoNode.className = 'error'
    return this
  }

  addNode (name, element) {
    node.append(this.node, element)
    if (name) {
      if (!this.firstInput) this.firstInput = element
      this.inputs[name] = element
      element.name = name
    }
    return this
  }
  addTitle (text) {
    this.addNode('', node.create('h3', false, text))
    return this
  }
  addMessage (message) {
    this.addNode('', node.create('span', false, message))
    return this
  }
  addSeparator () {
    node.append(this.node, node.create('hr'))
    return this
  }

  addTextBox (name, placeHolder) {
    const box = addInput(this, name, 'text')
    if (placeHolder) box.placeholder = placeHolder
    return this
  }
  addPasswordBox (name, placeholder = 'Authenticator password') {
    const box = addInput(this, name, 'password')
    if (sessionStorage.password) box.value = sessionStorage.password
    box.placeholder = placeholder
    return this
  }
  addAutofillPasswordBox (username, placeholder = 'Authenticator password') {
    const usernameNode = node.create('input', {
      readonly: true,
      name: 'username',
      value: username
    })
    this.addNode('', usernameNode).addPasswordBox('password', placeholder)
    node.hide(usernameNode)
    return this
  }
  addCheckBox (name, text, initialState) {
    const checkBox = addInput(this, name, 'checkbox')
    checkBox.checked = initialState
    checkBox.required = false
    checkBox.id = 'form-checkbox-' + name + Math.random()
    this.addNode('', node.create('label', { htmlFor: checkBox.id }, text))
    return this
  }
  addButton (name, text, continuation) {
    const button = addInput(this, name, 'button')
    button.value = text
    button.onclick = continuation
    return this
  }
  addFileSelector (name, text) {
    const button = addInput(this, '', 'button')
    const file = addInput(this, name, 'file')
    const label = node.create('label', null, 'No file selected')
    this.addNode('', label)
    node.hide(file)
    button.value = text
    button.onclick = () => file.click()
    button.style.float = 'left'
    file.onchange = () => { label.textContent = file.value.replace(/^.*\\/, '') }
    return this
  }
  addTextArea (name, placeHolder, rows) {
    const parameters = { placeholder: placeHolder, rows: rows }
    this.addNode(name, node.create('textarea', parameters))
    return this
  }
  addSubmit (text) {
    const parameters = { type: 'submit', textContent: text || '✔ Confirm' }
    this.addNode('submit', node.create('button', parameters))
    return this
  }

  optional (nameArray) {
    nameArray.forEach(name => { this.inputs[name].required = false })
    return this
  }
  select () {
    const element = this.firstInput
    if (element) element.focus()
    if (element.name === 'password') {
      timeout(30).then(() => {
        if (element.value !== '') element.nextSibling.focus()
      })
    }
    return this
  }
}

async function validate (form) {
  let anim
  if (form.inputs.submit) {
    anim = node.create('span', '.CL_loadingAnim')
    anim.style.position = 'fixed'
    node.append(form.inputs.submit, anim)
  }

  let answer
  for (let index in form.validators) {
    const validator = form.validators[index]
    try {
      answer = await validator(answer)
    } catch (error) {
      console.log(error)
      form.setError(error)
      if (anim) node.destroy(anim)
      return
    }
  }

  if (form.onExit) form.onExit()
  if (anim) node.destroy(anim)
}

function addInput (form, name, type) {
  const input = node.create('input', { type: type, required: true })
  form.addNode(name, input)
  return input
}
