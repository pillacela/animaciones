const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random');
const math = require('canvas-sketch-util/math');

// Configuración del canvas
const settings = {
  animate: true
};

// Crear el AudioContext y el Analizador para la música
const audio = new Audio('mp3/laraja.mp3');  // Asegúrate de que esta ruta sea correcta
console.log("Intentando cargar el audio...");

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
const source = audioContext.createMediaElementSource(audio);
source.connect(analyser);
analyser.connect(audioContext.destination);

// Verificar la carga del audio
audio.onloadeddata = () => {
  console.log("Audio cargado correctamente y listo para reproducir.");
  audio.play();
};

audio.onerror = (err) => {
  console.error("Error al cargar el audio:", err);
};

// Agregar un botón para pausar/reanudar la música
const playPauseButton = document.createElement('button');
playPauseButton.textContent = 'Pausar';
document.body.appendChild(playPauseButton);

let isPlaying = false;
playPauseButton.addEventListener('click', () => {
  if (isPlaying) {
    audio.pause();
    playPauseButton.textContent = 'Reanudar';
  } else {
    audio.play();
    playPauseButton.textContent = 'Pausar';
  }
  isPlaying = !isPlaying;
});

// Variables para el mouse
let mousePos = { x: 0, y: 0 };
document.addEventListener('mousemove', (event) => {
  mousePos = { x: event.clientX, y: event.clientY };
});

// Crear y actualizar el lienzo con tamaño responsive
const sketch = ({ context }) => {
  let width = window.innerWidth;
  let height = window.innerHeight;

  // Actualizar tamaño del lienzo cuando se redimensiona la ventana
  window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    context.canvas.width = width;
    context.canvas.height = height;
  });

  const agents = [];
  const numAgents = 50; // Número de agentes

  // Crear los agentes con posiciones aleatorias
  for (let i = 0; i < numAgents; i++) {
    const x = random.range(0, width);
    const y = random.range(0, height);
    agents.push(new Agent(x, y));
  }

  return ({ context, width, height }) => {
    // Obtener los datos de las frecuencias de la música
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // Dividir las frecuencias en rangos (graves, medios y agudos)
    const lowFreq = dataArray.slice(0, bufferLength / 3); // Graves
    const midFreq = dataArray.slice(bufferLength / 3, 2 * bufferLength / 3); // Medios
    const highFreq = dataArray.slice(2 * bufferLength / 3, bufferLength); // Agudos

    const lowAvg = lowFreq.reduce((sum, value) => sum + value, 0) / lowFreq.length;
    const midAvg = midFreq.reduce((sum, value) => sum + value, 0) / midFreq.length;
    const highAvg = highFreq.reduce((sum, value) => sum + value, 0) / highFreq.length;

    // Cambiar el color del fondo para que sea oscuro
    const backgroundColor = `rgb(${random.range(0, 50)}, ${random.range(0, 50)}, ${random.range(0, 50)})`;
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height); // Fondo dinámico

    // Dibujar conexiones entre los agentes
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];

      for (let j = i + 1; j < agents.length; j++) {
        const other = agents[j];
        const dist = agent.pos.getDistance(other.pos); // Calcular la distancia entre dos agentes
        if (dist > 200) continue;

        // Calcular un color dinámico basado en la distancia entre los agentes
        const color = `rgb(${math.mapRange(dist, 0, 200, 255, 50)}, ${math.mapRange(dist, 0, 200, 50, 255)}, 255)`;

        context.lineWidth = math.mapRange(dist, 0, 200, 12, 1);

        context.beginPath();
        context.moveTo(agent.pos.x, agent.pos.y); // Mover el puntero al agente actual
        context.lineTo(other.pos.x, other.pos.y); // Dibujar una línea al otro agente
        context.strokeStyle = color; // Asignar el color calculado a la línea
        context.stroke(); // Dibujar la línea
      }
    }

    // Dibujar todos los agentes
    agents.forEach(agent => {
      agent.update(lowAvg, midAvg, highAvg, agents); // Usar las frecuencias para influir en el movimiento
      agent.draw(context);
      agent.wrap(width, height);  // Hacer que los agentes se envuelvan en lugar de rebotar
    });
  };
};

canvasSketch(sketch, settings);

// Clase Vector para representar posiciones y distancias
class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  getDistance(vector) { // Calcular la distancia entre dos vectores
    const dx = this.x - vector.x;
    const dy = this.y - vector.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

// Clase Agent para los agentes que se moverán en el canvas
class Agent {
  constructor(x, y) {
    this.pos = new Vector(x, y);
    this.vel = new Vector(random.range(-1, 1), random.range(-1, 1));
    this.radius = random.range(4, 12);
    this.shape = random.range(0, 1) > 0.5 ? 'circle' : 'square'; // Alternar entre círculo y cuadrado
    this.color = `rgb(${random.range(0, 255)}, ${random.range(0, 255)}, ${random.range(0, 255)})`;
  }

  update(lowAvg, midAvg, highAvg, agents) {
    // Los movimientos de los agentes dependen de la música
    this.vel.x *= lowAvg * 0.01; // Movimiento más lento o rápido con los graves
    this.vel.y *= midAvg * 0.01; // Movimiento influenciado por los medios

    // Cambiar la forma y el color de los agentes según los agudos
    this.color = `rgb(${Math.min(highAvg, 255)}, ${Math.min(midAvg, 255)}, 255)`;

    // Separación de los agentes: repulsión cuando están muy cerca
    agents.forEach(otherAgent => {
      if (otherAgent === this) return;
      const dist = this.pos.getDistance(otherAgent.pos);
      if (dist < 50) { // Si están demasiado cerca, empujarlos
        const angle = Math.atan2(this.pos.y - otherAgent.pos.y, this.pos.x - otherAgent.pos.x);
        this.vel.x += Math.cos(angle) * 0.5;
        this.vel.y += Math.sin(angle) * 0.5;
      }
    });

    // Seguir al ratón
    const angle = Math.atan2(mousePos.y - this.pos.y, mousePos.x - this.pos.x);
    this.vel.x += Math.cos(angle) * 0.1;
    this.vel.y += Math.sin(angle) * 0.1;

    // Limitar la velocidad
    this.vel.x = math.clamp(this.vel.x, -2, 2);
    this.vel.y = math.clamp(this.vel.y, -2, 2);

    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
  }

  wrap(width, height) {
    // Hacer que los agentes se envuelvan en lugar de rebotar
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.x < 0) this.pos.x = width;

    if (this.pos.y > height) this.pos.y = 0;
    if (this.pos.y < 0) this.pos.y = height;
  }

  draw(context) {
    context.save();
    context.translate(this.pos.x, this.pos.y);

    context.lineWidth = 2;
    context.beginPath();
    if (this.shape === 'circle') {
      context.arc(0, 0, this.radius, 0, Math.PI * 2);
    } else {
      context.rect(-this.radius / 2, -this.radius / 2, this.radius, this.radius);
    }
    context.fillStyle = this.color;
    context.fill();
    context.strokeStyle = 'white';
    context.stroke();

    context.restore();
  }
}
