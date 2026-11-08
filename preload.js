'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = async (ch, ...a) => {
  const r = await ipcRenderer.invoke(ch, ...a);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

contextBridge.exposeInMainWorld('api', {
  call,
  on: (ch, fn) => {
    if (!['progress', 'toast', 'win:state', 'win:focus', 'game'].includes(ch)) return;
    ipcRenderer.on(ch, (_e, d) => fn(d));
  }
});
