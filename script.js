// Get DOM elements
const initialContainer = document.getElementById('initial-state-container');
const goalContainer = document.getElementById('goal-state-container');
const exportBtn = document.getElementById('export-btn');
const resetBtn = document.getElementById('reset-btn');
const toolsContainer = document.getElementById('tools');
const goalToolsContainer = document.getElementById('goal-tools');
const widthInput = document.getElementById('grid-width');
const heightInput = document.getElementById('grid-height');
const colorPicker = document.getElementById('color-picker');
const colorOptions = document.querySelectorAll('.color-option');

// Global variables
let mapWidth = parseInt(widthInput.value);
let mapHeight = parseInt(heightInput.value);
let selectedType = ' '; // e.g. "agent", "box", "+", " "
let selectedColor = 'blue'; // default color
let isDrawing = false;

// Global counters for agents – numbering is sequential for the initial grid.
let initialAgentGlobalCounter = 0;
// goalAgentGlobalCounter is maintained when reindexing initial state, but not when modifying the goal grid alone.
let goalAgentGlobalCounter = 0;

// For boxes, we count per color and record an allowed letter per color.
let initialBoxesByColor  = { blue: 0, red: 0, green: 0, yellow: 0, purple: 0 };
let goalBoxesByColor     = { blue: 0, red: 0, green: 0, yellow: 0, purple: 0 };
let allowedBoxLetter = {}; // e.g. allowedBoxLetter["blue"] = "A"

// This object maps current initial agent numbers (after creation/reindexing) to their colors.
// (When reindexing the initial grid, we rebuild this mapping.)
let initialAgentColors = {};

// Map arrays – the perimeter cells contain walls ('+')
let mapData = Array.from({ length: mapHeight }, (_, y) =>
  Array.from({ length: mapWidth }, (_, x) =>
    (x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1) ? '+' : ' '
  )
);
let goalMapData = Array.from({ length: mapHeight }, (_, y) =>
  Array.from({ length: mapWidth }, (_, x) =>
    (x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1) ? '+' : ' '
  )
);

// --- Color Picker Setup ---
colorOptions.forEach(option => {
  option.addEventListener('click', () => {
    colorOptions.forEach(opt => opt.classList.remove('selected-color'));
    option.classList.add('selected-color');
    selectedColor = option.dataset.color;
  });
});
if (colorOptions.length > 0) {
  colorOptions[0].classList.add('selected-color');
  selectedColor = colorOptions[0].dataset.color;
}

// --- Grid Creation Functions ---
function createGrid() {
  initialContainer.innerHTML = '';
  initialContainer.style.gridTemplateColumns = `repeat(${mapWidth}, 40px)`;
  initialContainer.style.gridTemplateRows = `repeat(${mapHeight}, 40px)`;
  initialContainer.style.gap = '2px';
  
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.x = x;
      cell.dataset.y = y;
      if (mapData[y][x] === '+') {
        cell.classList.add('wall');
        cell.textContent = '+';
      } else {
        cell.innerHTML = '';
      }
      // Mouse events for drawing on the initial grid:
      cell.addEventListener('mousedown', () => {
        isDrawing = true;
        startDrawing(cell, x, y);
      });
      cell.addEventListener('mousemove', () => {
        if (isDrawing) draw(cell, x, y);
      });
      cell.addEventListener('mouseup', () => { isDrawing = false; });
      cell.addEventListener('mouseleave', () => { isDrawing = false; });
      initialContainer.appendChild(cell);
    }
  }
}

function createGoalGrid() {
  goalContainer.innerHTML = '';
  goalContainer.style.gridTemplateColumns = `repeat(${mapWidth}, 40px)`;
  goalContainer.style.gridTemplateRows = `repeat(${mapHeight}, 40px)`;
  goalContainer.style.gap = '2px';
  
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.x = x;
      cell.dataset.y = y;
      if (mapData[y][x] === '+') {
        cell.classList.add('wall');
        cell.textContent = '+';
        goalMapData[y][x] = '+';
      } else {
        // If the goal cell has an agent or box (non-blank, non-wall), show it.
        cell.innerHTML = (goalMapData[y][x] && goalMapData[y][x] !== ' ') ? goalMapData[y][x] : '';
      }
      cell.addEventListener('click', () => { startDrawingGoal(cell, x, y); });
      goalContainer.appendChild(cell);
    }
  }
}

// --- Grid Resizing ---
function updateGridSize() {
  const newWidth = parseInt(widthInput.value);
  const newHeight = parseInt(heightInput.value);
  if (newWidth < 3 || newWidth > 20 || newHeight < 3 || newHeight > 20) return;
  mapWidth = newWidth;
  mapHeight = newHeight;
  
  mapData = Array.from({ length: mapHeight }, (_, y) =>
    Array.from({ length: mapWidth }, (_, x) =>
      (x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1) ? '+' : ' '
    )
  );
  goalMapData = Array.from({ length: mapHeight }, (_, y) =>
    Array.from({ length: mapWidth }, (_, x) =>
      (x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1) ? '+' : ' '
    )
  );
  
  // Reset global counters and allowed box letters.
  initialAgentGlobalCounter = 0;
  goalAgentGlobalCounter = 0;
  initialBoxesByColor  = { blue: 0, red: 0, green: 0, yellow: 0, purple: 0 };
  goalBoxesByColor     = { blue: 0, red: 0, green: 0, yellow: 0, purple: 0 };
  allowedBoxLetter = {};
  initialAgentColors = {};
  
  createGrid();
  createGoalGrid();
}
widthInput.addEventListener('input', updateGridSize);
heightInput.addEventListener('input', updateGridSize);

// --- Tool Selection ---
toolsContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('tool')) {
    toolsContainer.querySelectorAll('.tool').forEach(tool => tool.classList.remove('selected'));
    e.target.classList.add('selected');
    selectedType = e.target.dataset.type;
  }
});
goalToolsContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('tool')) {
    goalToolsContainer.querySelectorAll('.tool').forEach(tool => tool.classList.remove('selected'));
    e.target.classList.add('selected');
    selectedType = e.target.dataset.type;
  }
});

// --- Drawing Functions for Initial Grid ---
function startDrawing(cell, x, y) {
  applyTool(cell, x, y);
}
function draw(cell, x, y) {
  if (isDrawing) applyTool(cell, x, y);
}

function applyTool(cell, x, y) {
  // Do not allow drawing on perimeter cells.
  if (x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1) return;
  
  // Removal tool in initial grid:
  if (selectedType === ' ') {
    if (cell.firstChild) {
      if (cell.firstChild.classList.contains('agent-circle')) {
        // When removing an initial agent, remove its corresponding goal agent (if any)
        const agentDiv = cell.firstChild;
        const oldLabel = agentDiv.textContent;
        removeGoalAgent(oldLabel);
        mapData[y][x] = ' ';
        cell.innerHTML = '';
        // Reindex the initial state (which will update goal agents accordingly)
        reindexAllAgents();
      } else if (cell.firstChild.classList.contains('box-div')) {
        let classes = cell.firstChild.className.split(' ');
        let boxColor;
        classes.forEach(cls => {
          if (cls.startsWith('box-div-')) {
            boxColor = cls.split('box-div-')[1];
          }
        });
        if (boxColor) {
          initialBoxesByColor[boxColor] = Math.max((initialBoxesByColor[boxColor] || 0) - 1, 0);
        }
        mapData[y][x] = ' ';
        cell.innerHTML = '';
      }
    }
    // Also remove walls if present.
    if (cell.classList.contains('wall')) {
      mapData[y][x] = ' ';
      cell.innerHTML = '';
      cell.classList.remove('wall');
      // Update corresponding goal cell.
      goalMapData[y][x] = ' ';
      const goalCell = document.querySelector(`#goal-state-container .cell[data-x="${x}"][data-y="${y}"]`);
      if (goalCell) {
        goalCell.classList.remove('wall');
        goalCell.textContent = '';
      }
    }
    return;
  }
  
  // If drawing walls, allow painting over any cell.
  if (selectedType === '+') {
    // Remove any existing agent or box.
    if (cell.firstChild) {
      if (cell.firstChild.classList.contains('agent-circle')) {
        const agentDiv = cell.firstChild;
        const oldLabel = agentDiv.textContent;
        removeGoalAgent(oldLabel);
      } else if (cell.firstChild.classList.contains('box-div')) {
        let classes = cell.firstChild.className.split(' ');
        let boxColor;
        classes.forEach(cls => {
          if (cls.startsWith('box-div-')) {
            boxColor = cls.split('box-div-')[1];
          }
        });
        if (boxColor) {
          initialBoxesByColor[boxColor] = Math.max((initialBoxesByColor[boxColor] || 0) - 1, 0);
        }
      }
    }
    // Now draw the wall.
    mapData[y][x] = '+';
    cell.innerHTML = '+';
    if (!cell.classList.contains('wall')) {
      cell.classList.add('wall');
    }
    // Update corresponding goal cell.
    goalMapData[y][x] = '+';
    const goalCell = document.querySelector(`#goal-state-container .cell[data-x="${x}"][data-y="${y}"]`);
    if (goalCell) {
      if (!goalCell.classList.contains('wall')) {
        goalCell.classList.add('wall');
      }
      goalCell.textContent = '+';
    }
    return;
  }
  
  // Drawing agents or boxes (only if the cell is empty or blank)
  if (mapData[y][x] === '+' || mapData[y][x] === ' ') {
    if (selectedType === 'agent') {
      // Create a new initial agent.
      let newLabel = initialAgentGlobalCounter;
      mapData[y][x] = newLabel.toString();
      const agentDiv = document.createElement('div');
      agentDiv.className = `agent-circle agent-circle-${selectedColor}`;
      agentDiv.textContent = newLabel.toString();
      // Store the original agent number as a data attribute.
      agentDiv.dataset.agentId = newLabel.toString();
      cell.innerHTML = '';
      cell.appendChild(agentDiv);
      // Record the color mapping.
      initialAgentColors[newLabel] = selectedColor;
      initialAgentGlobalCounter++;
    } else if (selectedType === 'box') {
      const boxLetter = prompt("Enter a letter for the box (A-Z):", "A");
      if (boxLetter && /^[A-Z]$/.test(boxLetter)) {
        const upperLetter = boxLetter.toUpperCase();
        if (allowedBoxLetter[selectedColor] === undefined) {
          allowedBoxLetter[selectedColor] = upperLetter;
        } else if (allowedBoxLetter[selectedColor] !== upperLetter) {
          alert(`Only box ${allowedBoxLetter[selectedColor]} is allowed for ${selectedColor} in the initial state!`);
          return;
        }
        mapData[y][x] = upperLetter;
        const boxDiv = document.createElement('div');
        boxDiv.className = `box-div box-div-${selectedColor}`;
        boxDiv.textContent = upperLetter;
        cell.innerHTML = '';
        cell.appendChild(boxDiv);
        initialBoxesByColor[selectedColor] = (initialBoxesByColor[selectedColor] || 0) + 1;
      } else {
        alert("Invalid input. Please enter a single letter (a-z).");
      }
    }
  }
}

// --- Drawing Functions for Goal Grid ---
function startDrawingGoal(cell, x, y) {
  applyGoalTool(cell, x, y);
}

function applyGoalTool(cell, x, y) {
  if (x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1) return;
  
  // Removal tool for goal grid:
  if (selectedType === 'remove') {
    if (goalMapData[y][x] !== '+' && goalMapData[y][x] !== ' ') {
      if (cell.firstChild) {
        // When removing a goal agent or box, do NOT reindex the remaining goal agents.
        if (cell.firstChild.classList.contains('agent-circle-goal')) {
          goalMapData[y][x] = ' ';
          cell.innerHTML = '';
        } else if (cell.firstChild.classList.contains('box-div-goal')) {
          let classes = cell.firstChild.className.split(' ');
          let boxClass = classes.find(c => c.startsWith('box-div-') && c !== 'box-div-goal');
          if (boxClass) {
            let boxColor = boxClass.split('box-div-')[1];
            goalBoxesByColor[boxColor] = Math.max((goalBoxesByColor[boxColor] || 0) - 1, 0);
          }
          goalMapData[y][x] = ' ';
          cell.innerHTML = '';
        }
      }
    }
    return;
  }
  
  if (goalMapData[y][x] === '+') {
    alert("Cannot place on a wall!");
    return;
  }
  
  if (goalMapData[y][x] !== ' ') {
    alert("Cell already occupied!");
    return;
  }
  
  cell.innerHTML = '';
  
  if (selectedType === 'agent-goal') {
    // --- Allow adding a goal agent only if an initial agent of the selected color exists
    // and hasn’t yet been placed in the goal state.
    let allowedNumbers = [];
    for (const [num, color] of Object.entries(initialAgentColors)) {
      if (color === selectedColor) {
        allowedNumbers.push(parseInt(num));
      }
    }
    if (allowedNumbers.length === 0) {
      alert(`No initial agent with color ${selectedColor} exists!`);
      return;
    }
    
    // Get the numbers already used in the goal state.
    let usedNumbers = new Set();
    for (let yy = 0; yy < mapHeight; yy++) {
      for (let xx = 0; xx < mapWidth; xx++) {
        let cellVal = goalMapData[yy][xx];
        if (/^\d+$/.test(cellVal)) {
           usedNumbers.add(parseInt(cellVal));
        }
      }
    }
    
    // Filter allowedNumbers to those not yet used in the goal state.
    let availableNumbers = allowedNumbers.filter(num => !usedNumbers.has(num));
    
    if (availableNumbers.length === 0) {
      alert(`All initial agents of color ${selectedColor} have been placed in the goal state!`);
      return;
    }
    
    // Choose one available number (here, the smallest one)
    let newLabel = Math.min(...availableNumbers);
    
    goalMapData[y][x] = newLabel.toString();
    const agentDiv = document.createElement('div');
    agentDiv.className = `agent-circle-goal agent-circle-${selectedColor}`;
    agentDiv.textContent = newLabel.toString();
    // Store the corresponding initial agent number so that reindexing can update it.
    agentDiv.dataset.initialAgent = newLabel.toString();
    cell.appendChild(agentDiv);
  } else if (selectedType === 'box-goal') {
    if (allowedBoxLetter[selectedColor] === undefined) {
      alert(`No ${selectedColor} box defined in the initial state!`);
      return;
    }
    const boxLetter = prompt(
      `Enter the letter for the goal box (must be ${allowedBoxLetter[selectedColor]}):`,
      allowedBoxLetter[selectedColor]
    );
    if (boxLetter && /^[A-Z]$/.test(boxLetter)) {
      const upperLetter = boxLetter.toUpperCase();
      if (upperLetter !== allowedBoxLetter[selectedColor]) {
        alert(`Only box ${allowedBoxLetter[selectedColor]} is allowed for ${selectedColor} in the goal state!`);
        return;
      }
      let allowed = initialBoxesByColor[selectedColor] || 0;
      let current = goalBoxesByColor[selectedColor] || 0;
      if (current >= allowed) {
        alert(`You can only add ${allowed} ${selectedColor} box(es) (from the initial state)!`);
        return;
      }
      goalMapData[y][x] = upperLetter;
      const boxDiv = document.createElement('div');
      boxDiv.className = `box-div-goal box-div-${selectedColor}`;
      boxDiv.textContent = upperLetter;
      cell.appendChild(boxDiv);
      goalBoxesByColor[selectedColor] = current + 1;
    } else {
      alert("Invalid input. Please enter a single letter (a-z).");
    }
  }
}

// --- Helper: Remove a matching goal agent (by its displayed number) ---
function removeGoalAgent(number) {
  const goalAgents = Array.from(goalContainer.querySelectorAll('.agent-circle-goal'));
  for (const agentDiv of goalAgents) {
    if (agentDiv.textContent === number) {
      const cell = agentDiv.parentElement;
      goalMapData[parseInt(cell.dataset.y)][parseInt(cell.dataset.x)] = ' ';
      cell.innerHTML = '';
      break;
    }
  }
}

// --- Helper: Reindex initial state agents and update matching goal agents ---
// (This function is called only when changes occur in the initial state.)
function reindexAllAgents() {
  // Reindex initial grid agents (global order)
  const initialAgents = Array.from(initialContainer.querySelectorAll('.agent-circle'));
  // Sort by cell coordinates (for example, by row then column)
  initialAgents.sort((a, b) => {
    const ax = parseInt(a.parentElement.dataset.x);
    const ay = parseInt(a.parentElement.dataset.y);
    const bx = parseInt(b.parentElement.dataset.x);
    const by = parseInt(b.parentElement.dataset.y);
    return ay === by ? ax - bx : ay - by;
  });
  
  // Build a mapping from old initial agent numbers to new numbers.
  let mapping = {};
  initialAgents.forEach((agentDiv, index) => {
    // Save the old number (stored in data-agent-id)
    const oldNumber = agentDiv.dataset.agentId;
    agentDiv.textContent = index.toString();
    // Update the stored agent id
    agentDiv.dataset.agentId = index.toString();
    mapping[oldNumber] = index.toString();
    
    const cell = agentDiv.parentElement;
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    mapData[y][x] = index.toString();
    
    // Update initialAgentColors mapping: new number → color.
    let color = null;
    agentDiv.classList.forEach(cls => {
      if (cls.startsWith('agent-circle-')) {
        color = cls.substring('agent-circle-'.length);
      }
    });
    if (color) {
      initialAgentColors[index] = color;
    }
  });
  initialAgentGlobalCounter = initialAgents.length;
  
  // Now update goal grid agents to match the reindexing of the initial state.
  const goalAgents = Array.from(goalContainer.querySelectorAll('.agent-circle-goal'));
  goalAgents.forEach(agentDiv => {
    // Each goal agent stores the initial agent number it corresponded to.
    let oldInitial = agentDiv.dataset.initialAgent;
    if (mapping.hasOwnProperty(oldInitial)) {
      // Update its label to the new number.
      agentDiv.textContent = mapping[oldInitial];
      // Also update the corresponding cell in goalMapData.
      const cell = agentDiv.parentElement;
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      goalMapData[y][x] = mapping[oldInitial];
      // Update the stored initial number.
      agentDiv.dataset.initialAgent = mapping[oldInitial];
    } else {
      // If the corresponding initial agent no longer exists, remove the goal agent.
      agentDiv.parentElement.innerHTML = '';
    }
  });
  // (Optionally, update goalAgentGlobalCounter if you need it elsewhere.)
  goalAgentGlobalCounter = goalContainer.querySelectorAll('.agent-circle-goal').length;
}

// --- Reset and Export ---
resetBtn.addEventListener('click', () => {
  // Add the spin class to trigger the spin animation.
  resetBtn.classList.add('spin');

  // Listen for the end of the animation and then remove the spin class.
  resetBtn.addEventListener('animationend', () => {
    resetBtn.classList.remove('spin');
  }, { once: true });

  // Reset the map data for both the initial and goal states.
  mapData = Array.from({ length: mapHeight }, (_, y) =>
    Array.from({ length: mapWidth }, (_, x) =>
      (x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1) ? '+' : ' '
    )
  );
  goalMapData = Array.from({ length: mapHeight }, (_, y) =>
    Array.from({ length: mapWidth }, (_, x) =>
      (x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1) ? '+' : ' '
    )
  );

  // Reset global counters and allowed box letters.
  initialAgentGlobalCounter = 0;
  goalAgentGlobalCounter = 0;
  initialBoxesByColor  = { blue: 0, red: 0, green: 0, yellow: 0, purple: 0 };
  goalBoxesByColor     = { blue: 0, red: 0, green: 0, yellow: 0, purple: 0 };
  allowedBoxLetter = {};
  initialAgentColors = {};

  createGrid();
  createGoalGrid();
});


exportBtn.addEventListener('click', () => {
  // Verify that the goal state has at least one non-empty, non-wall cell.
  const hasGoals = goalMapData.some(row =>
    row.some(cell => cell !== ' ' && cell !== '+')
  );
  if (!hasGoals) {
    alert("No goals have been set in the goal state!");
    return;
  }
  
  // --- Build the dynamic #colors section ---
  // Scan the initial grid for all drawn agents and boxes,
  // group them by color, and create a string such as:
  // blue:0,1
  // red:2,3
  // green:4,5
  const allColors = ['blue', 'red', 'green', 'yellow', 'purple'];
  let colorsMapping = {};
  
  // Select all agent and box elements from the initial grid.
  const items = initialContainer.querySelectorAll('.agent-circle, .box-div');
  items.forEach(el => {
    let color = null;
    // Check the element's classes for the color.
    el.classList.forEach(cls => {
      if (cls.startsWith('agent-circle-')) {
        color = cls.substring('agent-circle-'.length);
      } else if (cls.startsWith('box-div-')) {
        color = cls.substring('box-div-'.length);
      }
    });
    if (color) {
      if (!colorsMapping[color]) {
        colorsMapping[color] = [];
      }
      // Use the element's text (trimmed) as its identifier.
      colorsMapping[color].push(el.textContent.trim());
    }
  });
  
  // Build the colors list in the desired format.
  let colorsList = "";
  allColors.forEach(color => {
    if (colorsMapping[color] && colorsMapping[color].length > 0) {
      colorsList += `${color}:${colorsMapping[color].join(',')}\n`;
    }
  });
  colorsList = colorsList.trim(); // remove trailing newline
  
  let levelName = prompt("Enter level name:", "CUSTOMLEVEL");
  let initialState = mapData.map(row => row.join("")).join("\n");
  let goalState = goalMapData.map(row => row.join("")).join("\n");
  let levelText = `#domain
hospital
#levelname
${levelName}
#colors
${colorsList}
#initial
${initialState}
#goal
${goalState}
#end`;
  
  const blob = new Blob([levelText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${levelName}.lvl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// --- Ensure drawing stops if mouse is released anywhere ---
document.addEventListener('mouseup', () => {
  isDrawing = false;
});

// --- Initialization ---
createGrid();
createGoalGrid();
