const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proboard', {
  getEmployees: () => ipcRenderer.invoke('get-employees'),
  addEmployee: (data) => ipcRenderer.invoke('add-employee', data),
  updateEmployee: (id, data) => ipcRenderer.invoke('update-employee', id, data),
  deleteEmployee: (id) => ipcRenderer.invoke('delete-employee', id),
  onEmployeesUpdated: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('employees-updated', handler);
    return () => ipcRenderer.removeListener('employees-updated', handler);
  },
  chooseExcelFile: () => ipcRenderer.invoke('choose-excel-file'),
  getWatchedFile: () => ipcRenderer.invoke('get-watched-file'),
  focusBoard: () => ipcRenderer.invoke('focus-board'),
});
