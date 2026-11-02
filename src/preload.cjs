const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('guides',{
 prepare:url=>ipcRenderer.invoke('prepare',url),sites:()=>ipcRenderer.invoke('sites'),scan:args=>ipcRenderer.invoke('scan',args),export:args=>ipcRenderer.invoke('export',args),cancel:()=>ipcRenderer.invoke('cancel'),open:()=>ipcRenderer.invoke('open'),folder:()=>ipcRenderer.invoke('folder'),history:()=>ipcRenderer.invoke('history'),
 onProgress:fn=>ipcRenderer.on('progress',(_e,data)=>fn(data))
});
