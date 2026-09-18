import {Ic} from "./ic";

// IC Editor Modal Handlers
const modal = document.getElementById('icEditorModal');
const openModalBtn = document.getElementById('createCustomIcTrigger');
const closeModalBtn = document.getElementById('closeIcModalBtn');
const cancelModalBtn = document.getElementById('cancelCustomIcBtn');
const saveIcBtn = document.getElementById('saveCustomIcBtn');
const heightInputEl = document.getElementById('icHeightInput') as HTMLInputElement;
const pinLabelsContainer = document.getElementById('icPinLabelsContainer');
const totalPinsCount = document.getElementById('totalPinsCount');

function renderPinInputs() {
  if (!pinLabelsContainer || !heightInputEl) return;
  const h = parseInt(heightInputEl.value || "4");
  const totalPins = h * 2;
  if (totalPinsCount) totalPinsCount.innerText = String(totalPins);
  let html = '';
  for (let i = 1; i <= totalPins; i++) {
    html += `
      <div class="pin-input-item">
        <span>Pin ${i}:</span>
        <input type="text" id="pinInput_${i}" placeholder="Label ${i}">
      </div>
    `;
  }
  pinLabelsContainer.innerHTML = html;
}

openModalBtn?.addEventListener('click', () => {
  renderPinInputs();
  if (modal) modal.style.display = 'flex';
});

closeModalBtn?.addEventListener('click', () => {
  if (modal) modal.style.display = 'none';
});

cancelModalBtn?.addEventListener('click', () => {
  if (modal) modal.style.display = 'none';
});

heightInputEl?.addEventListener('input', renderPinInputs);

saveIcBtn?.addEventListener('click', () => {
  const nameInput = document.getElementById('icNameInput') as HTMLInputElement;
  const widthInputEl = document.getElementById('icWidthInput') as HTMLInputElement;

  const name = nameInput?.value.trim() || 'Custom IC';
  const width = parseInt(widthInputEl?.value || '4');
  const height = parseInt(heightInputEl?.value || '4');
  const totalPins = height * 2;

  const pinDescriptions: Record<number, string> = {};
  for (let i = 1; i <= totalPins; i++) {
    const input = document.getElementById(`pinInput_${i}`) as HTMLInputElement;
    if (input && input.value.trim()) {
      pinDescriptions[i] = input.value.trim();
    }
  }

  const customIc = new Ic(width, height, pinDescriptions, name, true);
  Ic.add(customIc, true);

  if (modal) modal.style.display = 'none';
});
