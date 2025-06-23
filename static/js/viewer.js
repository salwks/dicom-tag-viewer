export function renderDicomImage(data) {
  const canvas = document.getElementById('dicomCanvas');
  const ctx = canvas.getContext('2d');
  const pixelGroup = data.children.find(group => group.name === 'Pixel Data');
  if (!pixelGroup || pixelGroup.children.length === 0) return;
  const pixelDataTag = pixelGroup.children.find(tag => tag.tag_id === '(7fe0,0010)');
  if (!pixelDataTag) return;
  const imageGroup = data.children.find(group => group.name === 'Image Information');
  const rows = getTagValue(imageGroup, '(0028,0010)');
  const cols = getTagValue(imageGroup, '(0028,0011)');
  const bitsAllocated = getTagValue(imageGroup, '(0028,0100)') || '8';
  if (!rows || !cols) return;
  const width = parseInt(cols);
  const height = parseInt(rows);
  canvas.width = width;
  canvas.height = height;
  const raw = pixelDataTag.value_field.replace(/[^0-9,]/g, '').split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
  const gray = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const val = raw[i] || 0;
    gray[i * 4 + 0] = val;
    gray[i * 4 + 1] = val;
    gray[i * 4 + 2] = val;
    gray[i * 4 + 3] = 255;
  }
  const imageData = new ImageData(gray, width, height);
  ctx.putImageData(imageData, 0, 0);
}
function getTagValue(group, tagId) {
  if (!group || !group.children) return null;
  const tag = group.children.find(t => t.tag_id === tagId);
  return tag ? tag.value_field : null;
}