const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const offScreenCanvas = document.createElement('canvas');
const offScreenCtx = offScreenCanvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let processTree = {};
let scale = 1;
let panX = canvas.width / 2;
let panY = canvas.height / 2;
let isDragging = false;
let startX, startY;
const radius = 500;

offScreenCanvas.width = 8000;
offScreenCanvas.height = 8000;

function drawText(ctx, x, y, name, angle) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '16px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    ctx.translate(x, y);
    if (angle > Math.PI / 2 && angle < (3 * Math.PI) / 2) {
        ctx.rotate(angle + Math.PI);
        ctx.textAlign = 'right';
        ctx.fillText(name, -8, 5);
    } else {
        ctx.rotate(angle);
        ctx.textAlign = 'left';
        ctx.fillText(name, 8, 5);
    }
    ctx.restore();
}

function getColorForUsage(usagePercent) {
    const red = [255, 0, 0];
    const blue = [69, 133, 136];
    const ratio = Math.min(usagePercent / 100, 1);

    const r = Math.round(blue[0] * (1 - ratio) + red[0] * ratio);
    const g = Math.round(blue[1] * (1 - ratio) + red[1] * ratio);
    const b = Math.round(blue[2] * (1 - ratio) + red[2] * ratio);

    return `rgb(${r},${g},${b})`;
}

function drawLine(ctx, fromX, fromY, toX, toY, controlX, controlY, cpuPercent) {
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(controlX, controlY, controlX, controlY, toX, toY);
    ctx.strokeStyle = getColorForUsage(cpuPercent);
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawDot(ctx, x, y, cpuPercent) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = getColorForUsage(cpuPercent);
    ctx.fill();
}

function calculateWeight(pid, processMap) {
    let weight = 1;
    const process = processMap[pid];
    if (process.children) {
        process.children.forEach(child => {
            weight += calculateWeight(child.pid, processMap);
        });
    }
    process.weight = weight;
    return weight;
}

function buildProcessTree(processes) {
    const processMap = {};
    processes.forEach(proc => {
        proc.name = proc.name.replace(/\.exe$/i, '');
        processMap[proc.pid] = proc;
        if (proc.ppid in processMap) {
            processMap[proc.ppid].children = processMap[proc.ppid].children || [];
            processMap[proc.ppid].children.push(proc);
        }
    });
    return processMap;
}

function distributeNodes(rootPids, processMap) {
    rootPids.sort((a, b) => processMap[b].weight - processMap[a].weight);

    const heavyNodes = [];
    const lightNodes = [];

    rootPids.forEach(pid => {
        if (processMap[pid].weight > 1) {
            heavyNodes.push(pid);
        } else {
            lightNodes.push(pid);
        }
    });

    if (heavyNodes.length === 0) {
        return lightNodes;
    }

    function calculateQuartiles(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const q1 = sorted[Math.floor(mid / 2)];
        const q3 = sorted[Math.ceil(mid + mid / 2)];
        return { q1, q3 };
    }

    const weights = heavyNodes.map(pid => processMap[pid].weight);
    const { q1, q3 } = calculateQuartiles(weights);

    const lowerQuartile = heavyNodes.filter(pid => processMap[pid].weight <= q1);
    const middleQuartile = heavyNodes.filter(pid => processMap[pid].weight > q1 && processMap[pid].weight < q3);
    const upperQuartile = heavyNodes.filter(pid => processMap[pid].weight >= q3);

    const interleavedHeavyNodes = [];
    let i = 0, j = 0, k = 0;
    while (i < lowerQuartile.length || j < middleQuartile.length || k < upperQuartile.length) {
        if (k < upperQuartile.length) interleavedHeavyNodes.push(upperQuartile[k++]);
        if (i < lowerQuartile.length) interleavedHeavyNodes.push(lowerQuartile[i++]);
        if (j < middleQuartile.length) interleavedHeavyNodes.push(middleQuartile[j++]);
    }

    const totalNodes = interleavedHeavyNodes.length + lightNodes.length;
    const interval = Math.ceil(totalNodes / interleavedHeavyNodes.length);
    const sorted = [];

    let lightIndex = 0, heavyIndex = 0;

    for (let i = 0; i < totalNodes; i++) {
        if (i % interval === 0 && heavyIndex < interleavedHeavyNodes.length) {
            sorted.push(interleavedHeavyNodes[heavyIndex++]);
        } else if (lightIndex < lightNodes.length) {
            sorted.push(lightNodes[lightIndex++]);
        }
    }

    return sorted;
}

function drawLineWithDot(ctx, x, y, usagePercent, name) {
    const lineLength = 100;
    const dotX = x;

    ctx.beginPath();
    ctx.moveTo(x - lineLength / 2, y);
    ctx.lineTo(x + lineLength / 2, y);
    ctx.strokeStyle = 'rgb(60, 56, 54)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(dotX, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = getColorForUsage(usagePercent);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillText(`${usagePercent.toFixed(1)}%`, x - lineLength / 2 - 40, y + 5);
    ctx.fillText(name, x + lineLength / 2 + 10, y + 5);
}

function drawUsageBars(ctx, systemInfo) {
    const barWidth = 100;
    const barHeight = 20;
    const x = offScreenCanvas.width / 2;
    let y = offScreenCanvas.height / 2 - 150;

    const cpuX = x - 150;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText(`CPU`, cpuX - 100 / 2 - 40, y + 15);
    ctx.fillStyle = 'rgb(60, 56, 54)';
    ctx.fillRect(cpuX - 100 / 2, y, barWidth, barHeight);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillRect(cpuX - 100 / 2, y, barWidth * (systemInfo.cpu_usage / 100), barHeight);
    ctx.fillText(`${systemInfo.cpu_usage.toFixed(1)}%`, cpuX + barWidth / 2 + 10, y + 15);

    y += 22;
    systemInfo.processes.sort((a, b) => b.cpu_percent - a.cpu_percent).slice(0, 5).forEach(proc => {
        y += 30;
        drawLineWithDot(ctx, cpuX, y, proc.cpu_percent, proc.name);
    });

    y = offScreenCanvas.height / 2 - 150;
    const memX = x + 150;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText(`MEM`, memX - 100 / 2 - 40, y + 15);
    ctx.fillStyle = 'rgb(60, 56, 54)';
    ctx.fillRect(memX - 100 / 2, y, barWidth, barHeight);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillRect(memX - 100 / 2, y, barWidth * (systemInfo.memory.percent / 100), barHeight);
    ctx.fillText(`${(systemInfo.memory.used / 1024 / 1024 / 1024).toFixed(1)}GB / ${(systemInfo.memory.total / 1024 / 1024 / 1024).toFixed(1)}GB`, memX + barWidth / 2 + 10, y + 15);

    y += 22;
    systemInfo.processes.sort((a, b) => b.memory_percent - a.memory_percent).slice(0, 5).forEach(proc => {
        y += 30;
        drawLineWithDot(ctx, memX, y, proc.memory_percent, proc.name);
    });

    drawNetworkSmiley(ctx, x, offScreenCanvas.height / 2 + 100, systemInfo.network);
}

function drawTextAlongArc(ctx, str, centerX, centerY, radius, startAngle, endAngle) {
    const angleStep = (endAngle - startAngle) / str.length;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(startAngle);

    for (let i = 0; i < str.length; i++) {
        ctx.save();
        ctx.translate(0, -radius);
        ctx.rotate(Math.PI);
        ctx.fillText(str[i], 0, 0);
        ctx.restore();
        ctx.rotate(angleStep);
    }
    ctx.restore();
}

function drawNetworkSmiley(ctx, x, y, networkInfo) {
    const texts = [
        `Sent: ${networkInfo.bytes_sent} bytes`,
        `,Received: ${networkInfo.bytes_recv} bytes`,
        `,Packets Sent: ${networkInfo.packets_sent}`,
        `,Packets Received: ${networkInfo.packets_recv}`,
    ].join(' ');

    const startAngle = 6 * Math.PI / 4;
    const endAngle = Math.PI / 2;
    const curveRadius = 300;

    ctx.font = '16px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    drawTextAlongArc(ctx, texts, x, y, curveRadius, startAngle, endAngle);
}

function drawProcessTree(ctx, processMap, rootPids, centerX, centerY, radius) {
    rootPids = distributeNodes(rootPids, processMap);

    const angleStep = (2 * Math.PI) / rootPids.length;
    rootPids.forEach((rootPid, index) => {
        const angle = index * angleStep;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        drawDot(ctx, x, y, processMap[rootPid].cpu_percent);
        drawText(ctx, x, y, processMap[rootPid].name, angle);
        const textWidth = ctx.measureText(processMap[rootPid].name).width + 30;
        const textEndX = x + textWidth * Math.cos(angle);
        const textEndY = y + textWidth * Math.sin(angle);

        drawSubTree(ctx, processMap, rootPid, textEndX, textEndY, radius, angle);
    });
}

function drawSubTree(ctx, processMap, pid, centerX, centerY, radius, parentAngle) {
    const root = processMap[pid];
    if (!root || !root.children) return;

    const childNodes = distributeNodes(root.children.map(child => child.pid), processMap);
    const childCount = childNodes.length;

    const baseAngleRange = Math.PI / 2;
    const minAngleRange = Math.PI / 10;
    const angleRange = childCount > 1
        ? minAngleRange + (baseAngleRange - minAngleRange) * Math.log(childCount + 1) / Math.log(10)
        : 0;

    const angleOffset = childCount > 1 ? angleRange / (childCount - 1) : 0;

    childNodes.forEach((childPid, index) => {
        const angle = childCount > 1
            ? parentAngle - angleRange / 2 + index * angleOffset
            : parentAngle;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        const controlX = (centerX + x) / 2;
        const controlY = centerY - 50;
        drawDot(ctx, x, y, processMap[childPid].cpu_percent);
        drawLine(ctx, centerX, centerY, x, y, controlX, controlY, processMap[childPid].cpu_percent);
        drawText(ctx, x, y, processMap[childPid].name, angle);
        drawSubTree(ctx, processMap, childPid, x, y, radius, angle);
    });
}

async function fetchSystemData() {
    try {
        const [processResponse, systemResponse] = await Promise.all([
            fetch('http://localhost:4444/process-info'),
            fetch('http://localhost:4444/system-info')
        ]);

        const processData = await processResponse.json();
        const systemData = await systemResponse.json();

        processData.processes = processData.processes.filter(proc => proc.name !== "System Idle Process");
        processTree = buildProcessTree(processData.processes);
        const systemInfo = { ...systemData, processes: processData.processes };

        const rootPids = processData.processes.map(proc => proc.pid);
        rootPids.forEach(pid => calculateWeight(pid, processTree));

        offScreenCtx.clearRect(0, 0, offScreenCanvas.width, offScreenCanvas.height);
        drawProcessTree(offScreenCtx, processTree, rootPids, offScreenCanvas.width / 2, offScreenCanvas.height / 2, radius);
        drawUsageBars(offScreenCtx, systemInfo);
        drawToScreen();
    } catch (error) {
        console.error('Error fetching process data:', error);
    }
}

function drawToScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);
    ctx.drawImage(offScreenCanvas, -offScreenCanvas.width / 2, -offScreenCanvas.height / 2);
    ctx.restore();
}

function handleWheel(event) {
    event.preventDefault();
    const scaleAmount = 1.1;
    scale *= event.deltaY < 0 ? scaleAmount : 1 / scaleAmount;
    drawToScreen();
}

function handleMouseDown(event) {
    isDragging = true;
    startX = event.clientX - panX;
    startY = event.clientY - panY;
}

function handleMouseMove(event) {
    if (isDragging) {
        panX = event.clientX - startX;
        panY = event.clientY - startY;
        drawToScreen();
    }
}

function handleMouseUp() {
    isDragging = false;
}

canvas.addEventListener('wheel', handleWheel);
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('mouseout', handleMouseUp);

setInterval(fetchSystemData, 5000);
fetchSystemData();
