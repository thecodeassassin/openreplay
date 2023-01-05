import type Message from './app/messages.gen.js'
import type App from './app/index.js'
//import { PluginPayload } from './app/messages.gen.js'

// TODO: sendState(name, action, state) for state plugins;
// maybe different kind of generic functions for being able

export interface Plugin {
  name: string
  version: string
  requiredTrackerVersion: string
  onStart: () => void
  onStop: () => void
  //onNode: () => void, this should be Node-with-ID
}

type PluginWrapper<T> = (app: AppForPlugins) => Partial<Plugin> & T

interface AppForPlugins {
  send(m: Message): void
  send(name: string, payload: Object): void
}

export function applyPlugin<T>(app: App, pluginWrapper: PluginWrapper<T>) {
  function send(m: Message): void
  function send(name: string, payload: Object): void
  function send(first: Message | string, second?: Object) {
    if (typeof first === 'string') {
      const paload = app.safe(() => JSON.stringify(second))() || ''
      //app.send(PluginPayload(first, payload)) // send PluginPayload message
      return
    }
    app.send(first)
  }
  const plugin = pluginWrapper({
    send,
  })

  if (plugin.onStart) {
    app.attachStartCallback(plugin.onStart)
  }
  if (plugin.onStop) {
    app.attachStopCallback(plugin.onStop)
  }

  return plugin
}
