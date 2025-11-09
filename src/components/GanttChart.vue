<template>
  <div class="gantt-container" ref="containerRef">
    <svg ref="svgRef"></svg>
  </div>
</template>

<script setup>
import * as d3 from "d3";
import { ref, onMounted, computed, nextTick, watch } from "vue";
import { useTasksStore } from "@/stores/tasksStore";

const tasksStore = useTasksStore();
const svgRef = ref(null);
const containerRef = ref(null);

let dependencyMode = false;

const groupedData = computed(() => {
  const groups = {};
  tasksStore.allTasks.forEach((task) => {
    const cat = task.category;
    if (!groups[cat]) {
      groups[cat] = {
        category: cat,
        color: task.color,
        tasks: [],
        minStart: task.start,
        maxEnd: task.end,
      };
    }
    groups[cat].tasks.push(task);
    if (new Date(task.start) < new Date(groups[cat].minStart))
      groups[cat].minStart = task.start;
    if (new Date(task.end) > new Date(groups[cat].maxEnd))
      groups[cat].maxEnd = task.end;
  });
  return Object.values(groups);
});

onMounted(async () => {
  await nextTick();
  renderChart();
});

// Watch for changes in tasks and re-render
watch(
  () => tasksStore.allTasks,
  () => {
    renderChart();
  },
  { deep: true }
);

function renderChart() {
  const svg = d3.select(svgRef.value);
  svg.selectAll("*").remove();

  // ---- shared drag and dependency state ----
  let activeDragTaskId = null;
  let dependencyActive = false;
  let dependencySourceTaskId = null;
  let dependencySourceType = null;

  const minDayWidth = 110;
  const dayCount = 7;
  const containerWidth = Math.max(
    containerRef.value.clientWidth,
    minDayWidth * dayCount
  );
  const topMargin = 50;
  const heightPerCategory = 32 + 32 + 64 + 32;
  const totalHeight =
    groupedData.value.length * heightPerCategory + topMargin + 40;

  const startOfWeek = new Date("2025-11-01");
  const endOfWeek = new Date("2025-11-07");
  const x = d3
    .scaleTime()
    .domain([startOfWeek, endOfWeek])
    .range([0, containerWidth]);

  svg
    .attr("width", containerWidth)
    .attr("height", totalHeight)
    .style("background", "#fff");

  // define arrowhead marker for dependency lines
  svg
    .append("defs")
    .append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 10)
    .attr("refY", 5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", "#94a3b8");

  const chart = svg.append("g");

  const dayWidth = containerWidth / dayCount;
  const days = d3.range(dayCount);
  chart
    .selectAll(".day-col")
    .data(days)
    .join("rect")
    .attr("x", (d) => d * dayWidth)
    .attr("y", 0)
    .attr("width", dayWidth)
    .attr("height", totalHeight)
    .attr("fill", (d) => (d % 2 ? "#fafafa" : "#f5f5f5"));

  const start = new Date(startOfWeek);
  chart
    .selectAll(".day-label")
    .data(days)
    .join("text")
    .attr("x", (d) => d * dayWidth + dayWidth / 2)
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .attr("fill", "#111827")
    .style("font-size", "13px")
    .style("font-weight", 600)
    .text((d) => d3.timeFormat("%b %d")(d3.timeDay.offset(start, d)));

  let yPos = topMargin;

  groupedData.value.forEach((group) => {
    const catStart = new Date(group.minStart);
    const catEnd = new Date(group.maxEnd);
    const catX = x(catStart);
    const catWidth = x(catEnd) - x(catStart);

    chart
      .append("rect")
      .attr("x", catX)
      .attr("y", yPos + 8)
      .attr("width", catWidth)
      .attr("height", 4)
      .attr("rx", 2)
      .attr("fill", group.color)
      .style("opacity", 0.9);

    chart
      .append("text")
      .attr("x", catX)
      .attr("y", yPos)
      .attr("fill", group.color)
      .style("font-size", "13px")
      .style("font-weight", 600)
      .text(group.category);

    yPos += 24;

    // --- tasks ---
    group.tasks.forEach((task) => {
      const start = new Date(task.start);
      const end = new Date(task.end);
      const xStart = x(start);
      const width = Math.max(x(end) - x(start), 8);

      const taskGroup = chart.append("g").attr("class", "task-group");

      // main bar
      const bar = taskGroup
        .append("rect")
        .attr("class", "task-bar")
        .attr("x", xStart)
        .attr("y", yPos)
        .attr("width", width)
        .attr("height", 32)
        .attr("rx", 8)
        .attr("fill", group.color);

      // indents
      const leftIndent = taskGroup
        .append("rect")
        .attr("class", "indent-left")
        .attr("x", xStart + 2)
        .attr("y", yPos + 4)
        .attr("width", 2)
        .attr("height", 24)
        .attr("rx", 1)
        .attr("fill", "#fff")
        .style("opacity", 0);

      const rightIndent = taskGroup
        .append("rect")
        .attr("class", "indent-right")
        .attr("x", xStart + width - 4)
        .attr("y", yPos + 4)
        .attr("width", 2)
        .attr("height", 24)
        .attr("rx", 1)
        .attr("fill", "#fff")
        .style("opacity", 0);

      // transparent drag zones
      const leftDragZone = taskGroup
        .append("rect")
        .attr("class", "indent-left-zone")
        .attr("x", xStart - 4)
        .attr("y", yPos + 4)
        .attr("width", 10)
        .attr("height", 24)
        .style("fill", "transparent")
        .style("cursor", "ew-resize");

      const rightDragZone = taskGroup
        .append("rect")
        .attr("class", "indent-right-zone")
        .attr("x", xStart + width - 8)
        .attr("y", yPos + 4)
        .attr("width", 10)
        .attr("height", 24)
        .style("fill", "transparent")
        .style("cursor", "ew-resize");

      // connector lines + cubes
      const leftLine = taskGroup
        .append("line")
        .attr("class", "connector-line-left")
        .attr("x1", xStart)
        .attr("y1", yPos + 16)
        .attr("x2", xStart - 12)
        .attr("y2", yPos + 16)
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 1.5)
        .style("opacity", 0);

      const leftCube = taskGroup
        .append("rect")
        .attr("class", `connector-cube-left cube-${task.id}-left`)
        .attr("x", xStart - 20)
        .attr("y", yPos + 12)
        .attr("width", 8)
        .attr("height", 8)
        .attr("rx", 2)
        .attr("fill", "#cbd5e1")
        .style("opacity", 0);

      const rightLine = taskGroup
        .append("line")
        .attr("class", "connector-line-right")
        .attr("x1", xStart + width)
        .attr("y1", yPos + 16)
        .attr("x2", xStart + width + 12)
        .attr("y2", yPos + 16)
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 1.5)
        .style("opacity", 0);

      const rightCube = taskGroup
        .append("rect")
        .attr("class", `connector-cube-right cube-${task.id}-right`)
        .attr("x", xStart + width + 12)
        .attr("y", yPos + 12)
        .attr("width", 8)
        .attr("height", 8)
        .attr("rx", 2)
        .attr("fill", "#cbd5e1")
        .style("opacity", 0);

      // text
      const label = taskGroup
        .append("text")
        .attr("x", xStart + 14)
        .attr("y", yPos + 21)
        .attr("fill", "#fff")
        .style("font-size", "12px")
        .style("font-weight", 500)
        .text(task.title);

      // Helper function to check if task has dependency on a connector
      const hasDependencyOnConnector = (taskId, connectorType) => {
        // Check if this task has a predecessor (for "to" side)
        const task = tasksStore.allTasks.find((t) => t.id === taskId);
        if (task && task.predecessor && task.predecessor.taskId !== null) {
          const linkType = task.predecessor.type || "FS";
          // Map link type to connector position
          let toType;
          if (linkType === "FS") toType = "left";
          else if (linkType === "SS") toType = "left";
          else if (linkType === "FF") toType = "right";
          else if (linkType === "SF") toType = "right";
          else toType = "left";
          
          if (toType === connectorType) return true;
        }
        
        // Check if this task is a predecessor for other tasks (for "from" side)
        const hasAsPredecessor = tasksStore.allTasks.some((t) => {
          if (t.predecessor && t.predecessor.taskId === taskId) {
            const linkType = t.predecessor.type || "FS";
            let fromType;
            if (linkType === "FS") fromType = "right";
            else if (linkType === "SS") fromType = "left";
            else if (linkType === "FF") fromType = "right";
            else if (linkType === "SF") fromType = "left";
            else fromType = "right";
            
            return fromType === connectorType;
          }
          return false;
        });
        
        return hasAsPredecessor;
      };

      // Check if task has a predecessor (one predecessor per task constraint)
      const hasPredecessor = task.predecessor && task.predecessor.taskId !== null;

      // --- Hover logic (hidden UI only, no outline) ---
      taskGroup
        .on("mouseenter", function () {
          if (activeDragTaskId !== null || dependencyMode) return;
          leftIndent.style("opacity", 1);
          rightIndent.style("opacity", 1);
          leftLine.style("opacity", 1);
          rightLine.style("opacity", 1);
          // Show cubes, but maintain disabled styling for left cube if task has predecessor
          if (hasPredecessor) {
            leftCube.style("opacity", 0.5).attr("fill", "#e2e8f0");
          } else {
            leftCube.style("opacity", 1);
          }
          rightCube.style("opacity", 1);
        })
        .on("mouseleave", function () {
          if (activeDragTaskId !== null || dependencyMode) return;
          leftIndent.style("opacity", 0);
          rightIndent.style("opacity", 0);
          // Only hide connectors if they don't have dependencies
          if (!hasDependencyOnConnector(task.id, "left")) {
            leftLine.style("opacity", 0);
            leftCube.style("opacity", 0);
          }
          if (!hasDependencyOnConnector(task.id, "right")) {
            rightLine.style("opacity", 0);
            rightCube.style("opacity", 0);
          }
        });

      // --- Dependency cube interactivity ---
      [leftCube, rightCube].forEach((cube, idx) => {
        const cubeType = idx === 0 ? "left" : "right";
        
        // Disable left cube (start point) if task has a predecessor
        const isDisabled = cubeType === "left" && hasPredecessor;
        
        if (isDisabled) {
          // Visual indication that left cube is disabled
          cube
            .attr("fill", "#e2e8f0")
            .style("opacity", 0.5)
            .style("cursor", "not-allowed");
        }

        cube
          .on("mouseenter", function () {
            if (activeDragTaskId === null && !isDisabled)
              d3.select(this).style("cursor", "pointer");
            else if (isDisabled)
              d3.select(this).style("cursor", "not-allowed");
          })
          .on("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            
            // Prevent clicking if disabled (task has predecessor and this is left cube)
            if (isDisabled) {
              return;
            }
            
            if (activeDragTaskId !== null) return;

            if (!dependencyActive) {
              dependencyActive = true;
              dependencyMode = true;
              dependencySourceTaskId = task.id;
              dependencySourceType = cubeType;

              // Show all connectors when entering dependency mode
              svg
                .selectAll(".connector-cube-left, .connector-cube-right, .connector-line-left, .connector-line-right")
                .style("opacity", 1);
            } else {
              if (dependencySourceTaskId !== task.id) {
                // Map connector positions to predecessor link types
                // FS: right → left (Finish-to-Start)
                // SS: left → left (Start-to-Start)
                // FF: right → right (Finish-to-Finish)
                // SF: left → right (Start-to-Finish)
                let linkType = "FS"; // default
                if (dependencySourceType === "left" && cubeType === "left") {
                  linkType = "SS";
                } else if (dependencySourceType === "right" && cubeType === "right") {
                  linkType = "FF";
                } else if (dependencySourceType === "left" && cubeType === "right") {
                  linkType = "SF";
                } else if (dependencySourceType === "right" && cubeType === "left") {
                  linkType = "FS";
                }

                // Create predecessor relationship on the successor task
                tasksStore.setPredecessor(task.id, {
                  taskId: dependencySourceTaskId,
                  type: linkType,
                  lag: 0 // Default lag, can be updated later
                });
                
                drawDependencies();
              }

              dependencyActive = false;
              dependencyMode = false;
              dependencySourceTaskId = null;
              dependencySourceType = null;
              // Hide all connectors, then show ones with dependencies
              svg
                .selectAll(".connector-cube-left, .connector-cube-right, .connector-line-left, .connector-line-right")
                .style("opacity", 0);
              // Re-show connectors for tasks with dependencies
              showConnectorsForDependencies();
            }
          });
      });

      // --- activate visuals while dragging (indents only) ---
      const activateDragVisuals = () => {
        leftIndent.style("opacity", 1);
        rightIndent.style("opacity", 1);
        leftLine.style("opacity", 0);
        rightLine.style("opacity", 0);
        leftCube.style("opacity", 0);
        rightCube.style("opacity", 0);
      };

      // --- Dragging logic (no minimum duration, prevent negative duration) ---
      const dragLeft = (function () {
        let blocked = false;
        return d3
          .drag()
          .on("start", function () {
            if (activeDragTaskId && activeDragTaskId !== task.id) {
              blocked = true;
              return;
            }
            blocked = false;
            activeDragTaskId = task.id;
            activateDragVisuals();
          })
          .on("drag", function (event) {
            if (blocked) return;
            // Prevent start from going past end (negative duration)
            const endX = x(end);
            const clampedX = Math.min(event.x, endX);
            const newX = Math.max(0, clampedX);
            const newWidth = x(end) - newX;

            bar.attr("x", newX).attr("width", newWidth);
            leftIndent.attr("x", newX + 2);
            leftDragZone.attr("x", newX - 4);
            label.attr("x", newX + 14);
          })
          .on("end", function (event) {
            if (blocked) return;
            // Prevent start from going past end (negative duration)
            const endX = x(end);
            const clampedX = Math.min(event.x, endX);
            const newStartDate = x.invert(Math.max(0, clampedX));
            // Ensure start date is not after end date
            const finalStartDate = newStartDate > end ? end : newStartDate;
            tasksStore.updateTaskTime(
              task.id,
              finalStartDate.toISOString(),
              null
            );
            activeDragTaskId = null;
            renderChart();
          });
      })();

      const dragRight = (function () {
        let blocked = false;
        return d3
          .drag()
          .on("start", function () {
            if (activeDragTaskId && activeDragTaskId !== task.id) {
              blocked = true;
              return;
            }
            blocked = false;
            activeDragTaskId = task.id;
            activateDragVisuals();
          })
          .on("drag", function (event) {
            if (blocked) return;
            // Prevent end from going before start (negative duration)
            const startX = x(start);
            const clampedX = Math.max(event.x, startX);
            const maxRight = containerWidth;
            const newEnd = Math.min(clampedX, maxRight);
            const newWidth = newEnd - xStart;
            bar.attr("width", newWidth);
            rightIndent.attr("x", xStart + newWidth - 4);
            rightDragZone.attr("x", xStart + newWidth - 8);
          })
          .on("end", function (event) {
            if (blocked) return;
            // Prevent end from going before start (negative duration)
            const startX = x(start);
            const clampedX = Math.max(event.x, startX);
            const newEnd = Math.min(clampedX, containerWidth);
            const newEndDate = x.invert(newEnd);
            // Ensure end date is not before start date
            const finalEndDate = newEndDate < start ? start : newEndDate;
            tasksStore.updateTaskTime(task.id, null, finalEndDate.toISOString());
            activeDragTaskId = null;
            renderChart();
          });
      })();

      leftDragZone.call(dragLeft);
      rightDragZone.call(dragRight);

      yPos += 40;
    });

    yPos += 48;
  });

  // --- Show connectors for tasks with dependencies ---
  function showConnectorsForDependencies() {
    // Collect all task IDs that have dependencies (from predecessor relationships)
    const tasksWithDeps = new Set();
    const taskConnectorTypes = {}; // { taskId: { left: boolean, right: boolean } }

    // Convert predecessor relationships to connector positions
    tasksStore.allTasks.forEach((task) => {
      if (task.predecessor && task.predecessor.taskId !== null) {
        const predecessorId = task.predecessor.taskId;
        const linkType = task.predecessor.type || "FS";
        
        tasksWithDeps.add(predecessorId);
        tasksWithDeps.add(task.id);

        // Map link type to connector positions
        // FS: right → left (Finish-to-Start)
        // SS: left → left (Start-to-Start)
        // FF: right → right (Finish-to-Finish)
        // SF: left → right (Start-to-Finish)
        let fromType, toType;
        if (linkType === "FS") {
          fromType = "right";
          toType = "left";
        } else if (linkType === "SS") {
          fromType = "left";
          toType = "left";
        } else if (linkType === "FF") {
          fromType = "right";
          toType = "right";
        } else if (linkType === "SF") {
          fromType = "left";
          toType = "right";
        } else {
          // Default to FS
          fromType = "right";
          toType = "left";
        }

        // Track which connector types are used
        if (!taskConnectorTypes[predecessorId]) {
          taskConnectorTypes[predecessorId] = { left: false, right: false };
        }
        if (!taskConnectorTypes[task.id]) {
          taskConnectorTypes[task.id] = { left: false, right: false };
        }

        // Mark the connector types used
        taskConnectorTypes[predecessorId][fromType] = true;
        taskConnectorTypes[task.id][toType] = true;
      }
    });

    // Show connectors for tasks with dependencies
    tasksWithDeps.forEach((taskId) => {
      const connectorTypes = taskConnectorTypes[taskId];
      // Find the task to check if it has a predecessor
      const task = tasksStore.allTasks.find((t) => t.id === taskId);
      const hasPredecessor = task && task.predecessor && task.predecessor.taskId !== null;
      
      if (connectorTypes.left) {
        // Find the left line and cube for this task
        const leftLine = svg.select(`.cube-${taskId}-left`).node();
        if (leftLine) {
          // Get the parent group and select the line
          const taskGroup = d3.select(leftLine.parentElement);
          const line = taskGroup.select(".connector-line-left");
          const cube = taskGroup.select(`.cube-${taskId}-left`);
          if (line.node()) line.style("opacity", 1);
          if (cube.node()) {
            cube.style("opacity", 1);
            // Maintain disabled styling if task has predecessor
            if (hasPredecessor) {
              cube.attr("fill", "#e2e8f0").style("opacity", 0.5);
            }
          }
        }
      }
      if (connectorTypes.right) {
        // Find the right line and cube for this task
        const rightLine = svg.select(`.cube-${taskId}-right`).node();
        if (rightLine) {
          // Get the parent group and select the line
          const taskGroup = d3.select(rightLine.parentElement);
          const line = taskGroup.select(".connector-line-right");
          const cube = taskGroup.select(`.cube-${taskId}-right`);
          if (line.node()) line.style("opacity", 1);
          if (cube.node()) cube.style("opacity", 1);
        }
      }
    });
  }

  // --- Draw dependencies between cubes ---
  function drawDependencies() {
    console.log("=== drawDependencies called ===");
    svg.selectAll(".dependency-line").remove();
    svg.selectAll(".lag-input-group").remove();

    // Convert predecessor relationships to visual dependencies
    const tasksWithPredecessors = tasksStore.allTasks.filter((t) => t.predecessor && t.predecessor.taskId !== null);
    console.log("Tasks with predecessors:", tasksWithPredecessors.length);
    
    tasksStore.allTasks.forEach((task) => {
      if (task.predecessor && task.predecessor.taskId !== null) {
        const predecessorId = task.predecessor.taskId;
        const linkType = task.predecessor.type || "FS";
        
        // Map link type to connector positions
        let fromType, toType;
        if (linkType === "FS") {
          fromType = "right";
          toType = "left";
        } else if (linkType === "SS") {
          fromType = "left";
          toType = "left";
        } else if (linkType === "FF") {
          fromType = "right";
          toType = "right";
        } else if (linkType === "SF") {
          fromType = "left";
          toType = "right";
        } else {
          // Default to FS
          fromType = "right";
          toType = "left";
        }

        const fromCube = svg.select(`.cube-${predecessorId}-${fromType}`).node();
        const toCube = svg.select(`.cube-${task.id}-${toType}`).node();
        if (!fromCube || !toCube) return;

        const fromRect = fromCube.getBoundingClientRect();
        const toRect = toCube.getBoundingClientRect();
        const svgRect = svg.node().getBoundingClientRect();
        const x1 = fromRect.x + fromRect.width / 2 - svgRect.x;
        const y1 = fromRect.y + fromRect.height / 2 - svgRect.y;
        const x2 = toRect.x + toRect.width / 2 - svgRect.x;
        const y2 = toRect.y + toRect.height / 2 - svgRect.y;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        // Create dependency line
        const dependencyLine = svg
          .append("path")
          .attr("class", "dependency-line")
          .attr("data-task-id", task.id)
          .attr("data-predecessor-id", predecessorId)
          .attr("d", `M${x1},${y1} Q${midX},${y1} ${x2},${y2}`)
          .attr("stroke", "#94a3b8")
          .attr("stroke-width", 1.5)
          .attr("fill", "none")
          .attr("marker-end", "url(#arrowhead)");

        // Calculate current lag based on link type
        const predecessorTask = tasksStore.allTasks.find((t) => t.id === predecessorId);
        if (predecessorTask) {
          const predStart = new Date(predecessorTask.start);
          const predEnd = new Date(predecessorTask.end);
          const taskStart = new Date(task.start);
          const taskEnd = new Date(task.end);
          
          let calculatedLag = 0;
          const msPerDay = 24 * 60 * 60 * 1000;
          
          if (linkType === "FS") {
            // Finish-to-Start: days between predecessor end and task start
            calculatedLag = (taskStart - predEnd) / msPerDay;
          } else if (linkType === "SS") {
            // Start-to-Start: days between predecessor start and task start
            calculatedLag = (taskStart - predStart) / msPerDay;
          } else if (linkType === "FF") {
            // Finish-to-Finish: days between predecessor end and task end
            calculatedLag = (taskEnd - predEnd) / msPerDay;
          } else if (linkType === "SF") {
            // Start-to-Finish: days between predecessor start and task end
            calculatedLag = (taskEnd - predStart) / msPerDay;
          }
          
          // Use stored lag if available, otherwise use calculated
          const currentLag = task.predecessor.lag !== undefined ? task.predecessor.lag : calculatedLag;
          const lagValue = Math.round(currentLag * 10) / 10; // Round to 1 decimal

          // Create lag input box (initially hidden)
          console.log("Creating lag input box for task:", task.id, "lag value:", lagValue);
          const boxWidth = 60;
          const boxHeight = 24;
          const lagGroup = svg
            .append("g")
            .attr("class", "lag-input-group")
            .attr("data-task-id", task.id)
            .style("opacity", 0)
            .style("pointer-events", "none");

          const lagBox = lagGroup
            .append("rect")
            .attr("x", midX - boxWidth / 2)
            .attr("y", midY - boxHeight / 2)
            .attr("width", boxWidth)
            .attr("height", boxHeight)
            .attr("rx", 4)
            .attr("fill", "#ffffff")
            .attr("stroke", "#94a3b8")
            .attr("stroke-width", 1)
            .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.1))");

          // Create foreignObject for input (centered on arrow)
          const inputWidth = 56;
          const inputHeight = 20;
          const foreignObject = lagGroup
            .append("foreignObject")
            .attr("x", midX - inputWidth / 2)
            .attr("y", midY - inputHeight / 2)
            .attr("width", inputWidth)
            .attr("height", inputHeight);

          const inputDiv = foreignObject
            .append("xhtml:div")
            .style("width", "100%")
            .style("height", "100%");

          const input = inputDiv
            .append("xhtml:input")
            .attr("type", "number")
            .attr("step", "0.1")
            .attr("value", lagValue)
            .style("width", "100%")
            .style("height", "100%")
            .style("border", "none")
            .style("outline", "none")
            .style("padding", "2px 4px")
            .style("font-size", "11px")
            .style("text-align", "center")
            .style("background", "transparent")
            .on("focus", function() {
              console.log("=== INPUT FOCUS EVENT ===");
              console.log("Input focused, value:", this.value);
            })
            .on("keydown", function(event) {
              console.log("=== KEYDOWN EVENT ===", event.key);
              // Prevent arrow keys from moving the input
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
              }
              // Handle Enter key - process update directly
              if (event.key === "Enter") {
                console.log("Enter key pressed, processing update directly");
                event.preventDefault();
                processLagUpdate.call(this, task, predecessorId, linkType);
              }
            })
            .on("input", function(event) {
              console.log("=== INPUT EVENT ===", this.value);
              // Limit to 1 decimal place
              let value = this.value;
              // Handle negative values
              const isNegative = value.startsWith("-");
              const cleanValue = isNegative ? value.substring(1) : value;
              
              if (cleanValue.includes(".")) {
                const parts = cleanValue.split(".");
                if (parts[1] && parts[1].length > 1) {
                  value = (isNegative ? "-" : "") + parts[0] + "." + parts[1].substring(0, 1);
                  this.value = value;
                }
              }
            })
            .on("blur", function(event) {
              console.log("=== BLUR EVENT FIRED ===");
              processLagUpdate.call(this, task, predecessorId, linkType);
            });
          
          // Helper function to process lag update
          function processLagUpdate(task, predecessorId, linkType) {
            console.log("=== PROCESSING LAG UPDATE ===");
            const newLag = parseFloat(this.value) || 0;
            console.log("New lag value:", newLag);
            console.log("Task ID:", task.id);
            console.log("Predecessor ID:", predecessorId);
            console.log("Link type:", linkType);
            
            tasksStore.updatePredecessorLag(task.id, newLag);
            console.log("Lag updated in store");
            
            // Recalculate task dates based on new lag while maintaining duration
            const predecessorTask = tasksStore.allTasks.find((t) => t.id === predecessorId);
            console.log("Predecessor task found:", !!predecessorTask);
            
            if (predecessorTask) {
              const predStart = new Date(predecessorTask.start);
              const predEnd = new Date(predecessorTask.end);
              const taskStart = new Date(task.start);
              const taskEnd = new Date(task.end);
              
              console.log("Predecessor dates:", {
                start: predStart.toISOString(),
                end: predEnd.toISOString()
              });
              console.log("Current task dates:", {
                start: taskStart.toISOString(),
                end: taskEnd.toISOString()
              });
              
              // Calculate current duration in days
              const msPerDay = 24 * 60 * 60 * 1000;
              const duration = (taskEnd - taskStart) / msPerDay;
              console.log("Current duration (days):", duration);
              
              // Calculate new dates based on link type and lag
              let newStart, newEnd;
              const lagMs = newLag * msPerDay;
              console.log("Lag in milliseconds:", lagMs);
              
              if (linkType === "FS") {
                // Finish-to-Start: Task starts after predecessor finishes + lag
                newStart = new Date(predEnd.getTime() + lagMs);
                newEnd = new Date(newStart.getTime() + duration * msPerDay);
                console.log("FS calculation: start after predecessor end + lag");
              } else if (linkType === "SS") {
                // Start-to-Start: Task starts when predecessor starts + lag
                newStart = new Date(predStart.getTime() + lagMs);
                newEnd = new Date(newStart.getTime() + duration * msPerDay);
                console.log("SS calculation: start when predecessor starts + lag");
              } else if (linkType === "FF") {
                // Finish-to-Finish: Task finishes when predecessor finishes + lag
                newEnd = new Date(predEnd.getTime() + lagMs);
                newStart = new Date(newEnd.getTime() - duration * msPerDay);
                console.log("FF calculation: finish when predecessor finishes + lag");
              } else if (linkType === "SF") {
                // Start-to-Finish: Task finishes when predecessor starts + lag
                newEnd = new Date(predStart.getTime() + lagMs);
                newStart = new Date(newEnd.getTime() - duration * msPerDay);
                console.log("SF calculation: finish when predecessor starts + lag");
              } else {
                // Default to FS
                newStart = new Date(predEnd.getTime() + lagMs);
                newEnd = new Date(newStart.getTime() + duration * msPerDay);
                console.log("Default FS calculation");
              }
              
              console.log("Calculated new dates:", {
                start: newStart.toISOString(),
                end: newEnd.toISOString()
              });
              
              // Update task dates
              tasksStore.updateTaskTime(
                task.id,
                newStart.toISOString(),
                newEnd.toISOString()
              );
              console.log("Task dates updated in store");
              
              // Verify the update
              const updatedTask = tasksStore.allTasks.find((t) => t.id === task.id);
              console.log("Updated task in store:", {
                id: updatedTask?.id,
                start: updatedTask?.start,
                end: updatedTask?.end
              });
            } else {
              console.error("Predecessor task not found!");
            }
            
            // Re-render to reflect changes (use nextTick to ensure Vue processes updates)
            console.log("Calling renderChart() in nextTick...");
            nextTick(() => {
              console.log("Inside nextTick, calling renderChart()");
              renderChart();
              console.log("renderChart() completed");
            });
          }

          // Track hover state
          let isHovered = false;
          let isFocused = false;

          // Show lag box on hover of dependency line or box
          dependencyLine
            .on("mouseenter", function() {
              console.log("=== DEPENDENCY LINE HOVER ===");
              isHovered = true;
              lagGroup
                .style("opacity", 1)
                .style("pointer-events", "all");
              console.log("Lag box shown, opacity:", lagGroup.style("opacity"));
            })
            .on("mouseleave", function() {
              isHovered = false;
              // Only hide if input is not focused
              if (!isFocused) {
                lagGroup
                  .style("opacity", 0)
                  .style("pointer-events", "none");
              }
            });

          // Keep box visible when hovering over the box itself
          lagGroup
            .on("mouseenter", function() {
              isHovered = true;
              lagGroup
                .style("opacity", 1)
                .style("pointer-events", "all");
            })
            .on("mouseleave", function() {
              isHovered = false;
              // Only hide if input is not focused
              if (!isFocused) {
                lagGroup
                  .style("opacity", 0)
                  .style("pointer-events", "none");
              }
            });

          // Keep box visible when input is focused
          input.on("focus", function() {
            isFocused = true;
            lagGroup
              .style("opacity", 1)
              .style("pointer-events", "all");
          });

          // Hide on blur if mouse is not over line or box
          input.on("blur", function() {
            isFocused = false;
            setTimeout(() => {
              if (!isHovered) {
                lagGroup
                  .style("opacity", 0)
                  .style("pointer-events", "none");
              }
            }, 100);
          });
        }
      }
    });

    // Show connectors for tasks with dependencies
    showConnectorsForDependencies();
  }

  // Cancel dependency mode when clicking background
  svg.on("click", (event) => {
    if (event.defaultPrevented) return;
    if (dependencyActive) {
      dependencyActive = false;
      dependencyMode = false;
      dependencySourceTaskId = null;
      dependencySourceType = null;
      // Hide all connectors, then show ones with dependencies
      svg
        .selectAll(".connector-cube-left, .connector-cube-right, .connector-line-left, .connector-line-right")
        .style("opacity", 0);
      // Re-show connectors for tasks with dependencies
      showConnectorsForDependencies();
    }
  });

  // render all existing dependencies
  drawDependencies();
}
</script>

<style scoped>
.gantt-container {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  background: #ffffff;
  user-select: none;
}

.task-bar,
.connector-line-left,
.connector-line-right,
.connector-cube-left,
.connector-cube-right {
  transition: all 0.12s ease-out;
}
</style>
