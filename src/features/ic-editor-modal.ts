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
const modalTitle = document.getElementById('icModalTitle');
const nameInputEl = document.getElementById('icNameInput') as HTMLInputElement;
const widthInputEl = document.getElementById('icWidthInput') as HTMLInputElement;

const CREATE_TITLE = '⚙ Create Custom IC / Component';
const EDIT_TITLE = '✎ Edit Custom IC / Component';

// Catalog entry being edited; undefined when creating a new IC.
let editingIc: Ic | undefined;

// Smallest usable IC: 2 columns so the body has width, 2 pins per side.
const IC_DIM_MIN = 2;

function readIcDimension(el: HTMLInputElement | null): number {
  const parsed = parseInt(el?.value ?? '', 10);
  return Math.max(IC_DIM_MIN, Number.isNaN(parsed) ? 4 : parsed);
}

function readPinLabels(totalPins: number): Record<number, string> {
  const labels: Record<number, string> = {};
  for (let i = 1; i <= totalPins; i++) {
    const input = document.getElementById(`pinInput_${i}`) as HTMLInputElement | null;
    if (input && input.value.trim()) {
      labels[i] = input.value.trim();
    }
  }
  return labels;
}

function renderPinInputs(labels?: Record<number, string>) {
  if (!pinLabelsContainer || !heightInputEl) return;
  // Keep labels already typed when the pin count changes.
  const existing = labels ?? readPinLabels(pinLabelsContainer.querySelectorAll('input').length);
  const h = readIcDimension(heightInputEl);
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
  // Set via .value rather than the template so labels are never parsed as HTML.
  for (let i = 1; i <= totalPins; i++) {
    const input = document.getElementById(`pinInput_${i}`) as HTMLInputElement | null;
    if (input && existing[i]) input.value = existing[i];
  }
}

openModalBtn?.addEventListener('click', () => {
  if (editingIc) {
    // Don't carry the previously edited IC's values into a new one.
    editingIc = undefined;
    nameInputEl.value = 'Custom Chip';
    widthInputEl.value = '4';
    heightInputEl.value = '4';
  }
  renderPinInputs({});
  if (modalTitle) modalTitle.innerText = CREATE_TITLE;
  if (modal) modal.style.display = 'flex';
});

export function editCustomIc(id: number | string) {
  const ic = Ic.IC_CONTAINER.find(item => String(item.id) === String(id));
  if (!ic || !ic.isCustom) return;
  editingIc = ic;
  nameInputEl.value = ic.name;
  widthInputEl.value = String(ic.widthPin);
  heightInputEl.value = String(ic.heightPin);
  renderPinInputs(ic.pinDescription);
  if (modalTitle) modalTitle.innerText = EDIT_TITLE;
  if (modal) modal.style.display = 'flex';
}

(window as any).editCustomIc = editCustomIc;

closeModalBtn?.addEventListener('click', () => {
  if (modal) modal.style.display = 'none';
});

cancelModalBtn?.addEventListener('click', () => {
  if (modal) modal.style.display = 'none';
});

heightInputEl?.addEventListener('input', () => renderPinInputs());

// Correct out-of-range values in the field itself once the user leaves it.
for (const el of [widthInputEl, heightInputEl]) {
  el?.addEventListener('change', () => {
    el.value = String(readIcDimension(el));
  });
}

saveIcBtn?.addEventListener('click', () => {
  const name = nameInputEl?.value.trim() || 'Custom IC';
  const width = readIcDimension(widthInputEl);
  const height = readIcDimension(heightInputEl);
  const pinDescriptions = readPinLabels(height * 2);

  if (editingIc) {
    // Only the catalog entry changes; ICs already placed on the board keep their own copy.
    editingIc.name = name;
    editingIc.widthPin = width;
    editingIc.heightPin = height;
    editingIc.pinDescription = pinDescriptions;
    Ic.saveCustomIcsToLocalStorage();
    Ic.showICs();
  } else {
    Ic.add(new Ic(width, height, pinDescriptions, name, true), true);
  }

  if (modal) modal.style.display = 'none';
});
