import * as node from '@cosmic-plus/jsutils/html'
import {timeout} from '@cosmic-plus/jsutils/misc'

const notificationsNode = node.grab('#notifications')

export class Notification {
  constructor (type, title, message, delay) {
    this.node = node.create('div', '.' + type)
    if (type === 'loading') {
      node.append(this.node, node.create('span', '.CL_loadingAnim'))
    }
    node.append(this.node, node.create('h3', null, title))
    node.append(notificationsNode, this.node)

    if (message) node.append(this.node, message)
    if (delay) timeout(delay).then(() => this.destroy())
  }

  show () { this.hidden = false }
  hide () { this.hidden = true }
  destroy () { node.destroy(this.node) }
}
