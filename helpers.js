import * as node from './cosmic-lib/node.js'

export function download (filename, data) {
  const a = node.create('a', {
    href: 'data:text/plain;charset=utf-8,' + encodeURIComponent(data),
    download: filename
  })
  node.append(document.body, a)
  a.click()
  node.destroy(a)
}

export function readFile (file) {
  const fileReader = new FileReader()
  fileReader.readAsText(file)

  const promise = new Promise(resolve => {
    fileReader.onload = event => resolve(event.target.result)
  })

  return promise
}

export async function copyContent (element) {
  node.copyContent(element)
  if (document.activeElement.value) {
    const prevNode = node.grab('#copied')
    if (prevNode) node.destroy(prevNode)
    const copiedNode = node.create('span', '#copied', 'Copied')
    element.parentNode.insertBefore(copiedNode, element.nextSibling)
    setTimeout(() => { copiedNode.hidden = true }, 3000)
  }
}
