<template>
  <div class="gantt-container" ref="containerRef">
    <svg ref="svgRef"></svg>
  </div>
</template>

<script setup>
import * as d3 from "d3";
import { ref, onMounted, computed, nextTick } from "vue";
import { useTasksStore } from "@/stores/tasksStore";

const tasksStore = useTasksStore();
const svgRef = ref(null);
const containerRef = ref(null);

let dependencyMode = false;
let dependencies = [];

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

      // --- Hover logic (hidden UI only, no outline) ---
      taskGroup
        .on("mouseenter", function () {
          if (activeDragTaskId !== null || dependencyMode) return;
          leftIndent.style("opacity", 1);
          rightIndent.style("opacity", 1);
          leftLine.style("opacity", 1);
          rightLine.style("opacity", 1);
          leftCube.style("opacity", 1);
          rightCube.style("opacity", 1);
        })
        .on("mouseleave", function () {
          if (activeDragTaskId !== null || dependencyMode) return;
          leftIndent.style("opacity", 0);
          rightIndent.style("opacity", 0);
          leftLine.style("opacity", 0);
          rightLine.style("opacity", 0);
          leftCube.style("opacity", 0);
          rightCube.style("opacity", 0);
        });

      // --- Dependency cube interactivity ---
      [leftCube, rightCube].forEach((cube, idx) => {
        const cubeType = idx === 0 ? "left" : "right";

        cube
          .on("mouseenter", function () {
            if (activeDragTaskId === null)
              d3.select(this).style("cursor", "pointer");
          })
          .on("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (activeDragTaskId !== null) return;

            if (!dependencyActive) {
              dependencyActive = true;
              dependencyMode = true;
              dependencySourceTaskId = task.id;
              dependencySourceType = cubeType;

              svg
                .selectAll(".connector-cube-left, .connector-cube-right")
                .style("opacity", 1);
            } else {
              if (dependencySourceTaskId !== task.id) {
                const newDep = {
                  from: dependencySourceTaskId,
                  to: task.id,
                  fromType: dependencySourceType,
                  toType: cubeType,
                };

                dependencies.push(newDep);
                drawDependencies();

                // keep all cubes visible after creating dependency
                svg
                  .selectAll(".connector-cube-left, .connector-cube-right")
                  .style("opacity", 1);
              }

              dependencyActive = false;
              dependencySourceTaskId = null;
              dependencySourceType = null;
              svg
                .selectAll(".connector-cube-left, .connector-cube-right")
                .style("opacity", 0);
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

      // --- Dragging logic (half-day clamp, no outline) ---
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
            const halfDayMs = 12 * 60 * 60 * 1000;
            const minStartTime = new Date(new Date(end).getTime() - halfDayMs);
            const minStartX = x(minStartTime);
            const clampedX = Math.min(event.x, minStartX);
            const newX = Math.max(0, clampedX);
            const newWidth = x(end) - newX;

            bar.attr("x", newX).attr("width", newWidth);
            leftIndent.attr("x", newX + 2);
            leftDragZone.attr("x", newX - 4);
            label.attr("x", newX + 14);
          })
          .on("end", function (event) {
            if (blocked) return;
            const halfDayMs = 12 * 60 * 60 * 1000;
            const minStartTime = new Date(new Date(end).getTime() - halfDayMs);
            const minStartX = x(minStartTime);
            const clampedX = Math.min(event.x, minStartX);
            const newStartDate = x.invert(Math.max(0, clampedX));
            tasksStore.updateTaskTime(
              task.id,
              newStartDate.toISOString(),
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
            const halfDayMs = 12 * 60 * 60 * 1000;
            const minEndTime = new Date(new Date(start).getTime() + halfDayMs);
            const minEndX = x(minEndTime);
            const clampedX = Math.max(event.x, minEndX);
            const maxRight = containerWidth;
            const newEnd = Math.min(clampedX, maxRight);
            const newWidth = newEnd - xStart;
            bar.attr("width", newWidth);
            rightIndent.attr("x", xStart + newWidth - 4);
            rightDragZone.attr("x", xStart + newWidth - 8);
          })
          .on("end", function (event) {
            if (blocked) return;
            const halfDayMs = 12 * 60 * 60 * 1000;
            const minEndTime = new Date(new Date(start).getTime() + halfDayMs);
            const minEndX = x(minEndTime);
            const clampedX = Math.max(event.x, minEndX);
            const newEnd = Math.min(clampedX, containerWidth);
            const newEndDate = x.invert(newEnd);
            tasksStore.updateTaskTime(task.id, null, newEndDate.toISOString());
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

  // --- Draw dependencies between cubes ---
  function drawDependencies() {
    svg.selectAll(".dependency-line").remove();

    dependencies.forEach((dep) => {
      const fromCube = svg.select(`.cube-${dep.from}-${dep.fromType}`).node();
      const toCube = svg.select(`.cube-${dep.to}-${dep.toType}`).node();
      if (!fromCube || !toCube) return;

      const fromRect = fromCube.getBoundingClientRect();
      const toRect = toCube.getBoundingClientRect();
      const svgRect = svg.node().getBoundingClientRect();
      const x1 = fromRect.x + fromRect.width / 2 - svgRect.x;
      const y1 = fromRect.y + fromRect.height / 2 - svgRect.y;
      const x2 = toRect.x + toRect.width / 2 - svgRect.x;
      const y2 = toRect.y + toRect.height / 2 - svgRect.y;
      const midX = (x1 + x2) / 2;

      svg
        .append("path")
        .attr("class", "dependency-line")
        .attr("d", `M${x1},${y1} Q${midX},${y1} ${x2},${y2}`)
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", 1.5)
        .attr("fill", "none")
        .attr("marker-end", "url(#arrowhead)");
    });
  }

  // Cancel dependency mode when clicking background
  svg.on("click", (event) => {
    if (event.defaultPrevented) return;
    if (dependencyActive) {
      dependencyActive = false;
      dependencySourceTaskId = null;
      dependencySourceType = null;
      svg
        .selectAll(".connector-cube-left, .connector-cube-right")
        .style("opacity", 0);
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
