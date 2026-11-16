'use strict';

const folderField = document.getElementById('folder');
const copyButton = document.getElementById('copy');
const status = document.getElementById('copy-status');

if (location.protocol === 'file:') {
  const folder = new URL('extension/', location.href);
  folderField.value = decodeURIComponent(folder.pathname).replace(/\/$/u, '');
  copyButton.hidden = false;
}

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(folderField.value);
    status.textContent = 'Folder path copied.';
  } catch {
    folderField.select();
    status.textContent = 'Press Command+C to copy the selected path.';
  }
});
