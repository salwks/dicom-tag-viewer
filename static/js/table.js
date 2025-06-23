import { copyToClipboard } from './utils.js';

export function populateTagTable(data) {
  const tbody = document.getElementById('tagTable').querySelector('tbody');
  tbody.innerHTML = '';

  function addTags(tags) {
    tags.forEach(tag => {
      const row = document.createElement('tr');
      const valueCell = document.createElement('td');
      if (String(tag.value_field).length > 50) {
        const span = document.createElement('span');
        span.textContent = tag.value_field.slice(0, 50) + '...';
        span.title = tag.value_field;
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋';
        copyBtn.className = 'ml-2 text-blue-500';
        copyBtn.onclick = () => copyToClipboard(tag.value_field);
        valueCell.appendChild(span);
        valueCell.appendChild(copyBtn);
      } else {
        valueCell.textContent = tag.value_field;
      }
      row.innerHTML = `
        <td class="border px-2 py-1 text-xs">${tag.tag_id}</td>
        <td class="border px-2 py-1 text-xs">${tag.description}</td>
        <td class="border px-2 py-1 text-xs">${tag.vr}</td>
        <td class="border px-2 py-1 text-xs">${tag.vm}</td>
        <td class="border px-2 py-1 text-xs">${tag.value_length}</td>
      `;
      row.appendChild(valueCell);
      tbody.appendChild(row);
    });
  }

  data.children.forEach(group => {
    if (group.children && group.children.length > 0) {
      addTags(group.children);
    }
  });
}