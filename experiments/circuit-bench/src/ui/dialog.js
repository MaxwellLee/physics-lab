// UI 层：模型说明对话框。

const $ = id => document.getElementById(id);

export function attachDialog() {
  $('model-info').addEventListener('click', () => $('model-dialog').showModal());
  $('dialog-close').addEventListener('click', () => $('model-dialog').close());
  $('model-dialog').addEventListener('click', (event) => {
    if (event.target === $('model-dialog')) $('model-dialog').close();
  });
}
