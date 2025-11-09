# Gantt Chart POC - Implementation Context

## Project Overview
**Goal**: Create a Gantt chart that can render a year's worth of tasks with dependencies smoothly.

**Current Status**: Basic Gantt chart with D3.js, task dependencies, and predecessor relationships implemented.

---

## Tech Stack
- **Vue 3** (Composition API)
- **D3.js v7.9.0** (for SVG rendering and interactions)
- **Pinia** (state management)
- **Vite** (build tool)

---

## Current Features Implemented

### 1. Task Visualization
- ✅ Task bars grouped by category with color coding
- ✅ Time-based visualization with day columns
- ✅ Task labels displayed on bars
- ✅ Category headers with timeline indicators

### 2. Task Interaction
- ✅ **Drag-to-resize**: Left and right edges can be dragged to adjust start/end dates
- ✅ **No minimum duration**: Tasks can have any positive duration (no 12-hour minimum)
- ✅ **Negative duration prevention**: System prevents start date from going past end date
- ✅ **Half-day increments**: Drag operations respect time boundaries

### 3. Dependency System
- ✅ **Visual dependencies**: Arrows connecting tasks via connector cubes
- ✅ **Connector cubes**: Left (start) and right (end) cubes on each task
- ✅ **Hover effects**: Connectors appear on hover, stay visible for tasks with dependencies
- ✅ **Dependency creation**: Click cubes to create dependencies between tasks
- ✅ **Dependency visualization**: Curved arrows with arrowheads showing relationships

### 4. Predecessor Relationships
- ✅ **Predecessor structure**: Each task can have one predecessor with:
  - `taskId`: Reference to predecessor task
  - `type`: Link type ("FS", "SS", "FF", "SF")
  - `lag`: Days offset (supports decimals, positive/negative)
- ✅ **Link type mapping**:
  - **FS (Finish-to-Start)**: right cube → left cube
  - **SS (Start-to-Start)**: left cube → left cube
  - **FF (Finish-to-Finish)**: right cube → right cube
  - **SF (Start-to-Finish)**: left cube → right cube
- ✅ **One predecessor constraint**: Tasks with predecessors have disabled left cube (start point)
- ✅ **Visual feedback**: Disabled cubes are grayed out with reduced opacity

### 5. Lag Management
- ✅ **Lag input box**: Appears on hover of dependency arrows (centered on arrow)
- ✅ **Lag calculation**: Automatically calculates lag based on link type and current dates
- ✅ **Editable lag**: Input field with 1 decimal precision, supports negative values
- ✅ **Date recalculation**: Changing lag updates task dates while maintaining duration
- ✅ **Link type-specific calculations**:
  - FS: Days between predecessor end and task start
  - SS: Days between predecessor start and task start
  - FF: Days between predecessor end and task end
  - SF: Days between predecessor start and task end

### 6. State Management
- ✅ **Pinia store**: Centralized task and dependency management
- ✅ **Reactive updates**: Chart re-renders when tasks change
- ✅ **Store actions**:
  - `updateTaskTime(id, newStart, newEnd)`
  - `setPredecessor(taskId, predecessor)`
  - `updatePredecessorLag(taskId, lag)`
  - `removePredecessor(taskId)`

---

## Architecture

### Component Structure
```
GanttChart.vue
├── SVG Container (D3 rendered)
│   ├── Day columns (alternating background)
│   ├── Category groups
│   │   ├── Category header
│   │   └── Tasks
│   │       ├── Task bar
│   │       ├── Drag zones (left/right)
│   │       ├── Connector lines & cubes
│   │       └── Task label
│   ├── Dependency arrows
│   └── Lag input boxes (on hover)
└── Reactivity
    ├── Watch on tasksStore.allTasks
    └── renderChart() function
```

### Data Structure

#### Task Object
```javascript
{
  id: number,
  title: string,
  category: string,
  color: string,
  start: string (ISO date),
  end: string (ISO date),
  predecessor: {
    taskId: number | null,
    type: "FS" | "SS" | "FF" | "SF",
    lag: number (default: 0)
  } | null
}
```

#### Dependency (Visual)
```javascript
{
  from: taskId,
  to: taskId,
  fromType: "left" | "right",
  toType: "left" | "right"
}
```

### Key Functions

#### `renderChart()`
- Main rendering function
- Clears and redraws entire chart
- Called on mount and when tasks change
- Handles all D3 selections and updates

#### `drawDependencies()`
- Converts predecessor relationships to visual arrows
- Creates lag input boxes
- Maps link types to connector positions

#### `showConnectorsForDependencies()`
- Shows connector lines and cubes for tasks with dependencies
- Respects disabled state for tasks with predecessors

#### `processLagUpdate()`
- Handles lag value changes
- Recalculates task dates based on link type
- Maintains task duration
- Updates store and re-renders chart

---

## Implementation Details

### Date Handling
- All dates stored as ISO strings
- D3 time scales for positioning
- Duration calculated in milliseconds, converted to days
- Lag applied in milliseconds for precision

### Drag Constraints
- **Left drag**: Cannot go past end date (prevents negative duration)
- **Right drag**: Cannot go before start date (prevents negative duration)
- No minimum duration enforced
- Drag zones are transparent overlays for better UX

### Dependency Creation Flow
1. User clicks first cube → enters dependency mode
2. All connectors become visible
3. User clicks second cube → creates dependency
4. System maps connector positions to link type
5. Predecessor relationship stored on successor task
6. Chart re-renders to show new dependency

### Lag Update Flow
1. User hovers over dependency arrow → lag box appears
2. User edits lag value → input validation (1 decimal max)
3. User presses Enter or blurs → `processLagUpdate()` called
4. New dates calculated based on link type and lag
5. Task dates updated in store
6. Chart re-renders to show new position

---

## Performance Considerations (For Future Scaling)

### Current Limitations
- **Full re-render**: `renderChart()` clears and redraws entire chart
- **No virtualization**: All tasks rendered regardless of viewport
- **Fixed date range**: Currently hardcoded to 7 days (Nov 1-7, 2025)
- **No zoom/pan**: Chart doesn't support time range navigation

### Optimizations Needed for Year-Scale Rendering

#### 1. Viewport Virtualization
- Only render tasks visible in current viewport
- Use `IntersectionObserver` or manual viewport calculations
- Implement scrolling with dynamic task loading

#### 2. Time Range Management
- Make date range dynamic based on task data
- Implement zoom levels (day/week/month/quarter/year views)
- Add pan/scroll controls for navigation

#### 3. Incremental Updates
- Instead of full re-render, update only changed elements
- Use D3's data binding more efficiently
- Track which tasks changed and update selectively

#### 4. Canvas Rendering (Alternative)
- Consider Canvas API for better performance with many tasks
- SVG can be slow with 1000+ elements
- Canvas provides better performance for large datasets

#### 5. Data Pagination
- Load tasks in chunks based on visible date range
- Implement lazy loading for tasks outside viewport
- Cache rendered elements when possible

#### 6. Dependency Optimization
- Only render dependencies for visible tasks
- Use simplified arrow rendering for distant dependencies
- Consider hiding dependencies at certain zoom levels

---

## Future Features to Implement

### High Priority
1. **Dynamic Date Range**
   - Calculate min/max dates from tasks
   - Support arbitrary date ranges
   - Auto-adjust viewport

2. **Zoom & Pan**
   - Zoom controls (day/week/month/quarter/year)
   - Pan/scroll through timeline
   - Smooth transitions

3. **Task Creation/Deletion**
   - Add new tasks via UI
   - Delete tasks
   - Edit task properties

4. **Cascade Updates**
   - When predecessor dates change, update all successors
   - Recursive date recalculation
   - Visual feedback during updates

5. **Circular Dependency Detection**
   - Frontend validation (backend will handle final validation)
   - Visual warnings
   - Prevent invalid connections

### Medium Priority
1. **Task Grouping/Collapsing**
   - Collapsible category groups
   - Summary bars for groups
   - Expand/collapse animations

2. **Task Filtering**
   - Filter by category
   - Filter by date range
   - Search tasks

3. **Export Functionality**
   - Export to image (PNG/SVG)
   - Export to PDF
   - Export data (JSON/CSV)

4. **Task Details Panel**
   - Side panel with task details
   - Edit task properties
   - View dependencies

5. **Milestone Support**
   - Different visual style for milestones
   - Zero-duration tasks
   - Special rendering

### Low Priority
1. **Task Colors Customization**
   - User-defined colors
   - Color by status/priority
   - Color themes

2. **Timeline Markers**
   - Today marker
   - Custom date markers
   - Deadline indicators

3. **Task Progress**
   - Progress bars on tasks
   - Completion percentage
   - Visual progress indicators

4. **Keyboard Shortcuts**
   - Navigation shortcuts
   - Quick actions
   - Accessibility improvements

---

## Known Issues & Limitations

1. **Full Re-render**: Chart completely redraws on any change (performance concern for large datasets)
2. **Fixed Date Range**: Hardcoded to Nov 1-7, 2025 (needs dynamic calculation)
3. **No Zoom/Pan**: Cannot navigate through time (critical for year view)
4. **No Virtualization**: All tasks rendered even if not visible
5. **Dependency Arrows**: May overlap with many dependencies (needs smart routing)
6. **Lag Input**: Only visible on hover (could be confusing for users)

---

## Testing Scenarios Covered

### Dependency Creation
- ✅ FS link (right → left)
- ✅ SS link (left → left)
- ✅ FF link (right → right)
- ✅ SF link (left → right)
- ✅ Prevents creating dependency from task with existing predecessor (left cube disabled)

### Lag Management
- ✅ Lag calculation for all link types
- ✅ Lag editing with 1 decimal precision
- ✅ Negative lag support
- ✅ Date recalculation maintaining duration
- ✅ Visual updates after lag change

### Task Interaction
- ✅ Drag to resize (left/right edges)
- ✅ Duration preservation
- ✅ Negative duration prevention

---

## Code Organization

### Files
- `src/components/GanttChart.vue` - Main chart component (1017 lines)
- `src/stores/tasksStore.js` - Pinia store for tasks (167 lines)
- `Task Predecessor Testing Documentation.txt` - Backend API constraints reference

### Key Sections in GanttChart.vue
1. **Setup & Reactivity** (lines 1-53)
   - Imports, refs, computed properties
   - Watch on tasks for auto-update

2. **renderChart()** (lines 54-627)
   - Main rendering logic
   - SVG setup, scales, day columns
   - Task rendering with drag handlers

3. **Dependency Functions** (lines 628-907)
   - `showConnectorsForDependencies()`
   - `drawDependencies()`
   - `processLagUpdate()`

4. **Event Handlers** (lines 908-1017)
   - Hover state management
   - Dependency mode handling

---

## Integration Points

### Backend API (Future)
- Task CRUD operations
- Predecessor relationship management
- Date recalculation (backend handles cascade updates)
- Circular dependency validation
- Bulk operations for performance

### Data Flow
```
Backend API → Pinia Store → GanttChart Component → D3 SVG Rendering
                ↑                                           ↓
                └─────────── User Interactions ─────────────┘
```

---

## Performance Benchmarks (Target)

### Current (7 days, ~10 tasks)
- Initial render: < 100ms
- Drag operation: < 50ms
- Dependency update: < 100ms

### Target (1 year, 1000+ tasks)
- Initial render: < 500ms
- Viewport scroll: < 100ms
- Task update: < 200ms
- Zoom level change: < 300ms

---

## Notes for Future Development

1. **D3 Data Binding**: Currently using `.selectAll().data().join()` pattern - good for updates
2. **Event Delegation**: Consider event delegation for better performance with many tasks
3. **Memoization**: Cache calculated positions and dimensions
4. **RequestAnimationFrame**: Use for smooth animations during drag operations
5. **Web Workers**: Consider offloading date calculations for large datasets
6. **IndexedDB**: Cache task data locally for faster initial load

---

## References

- **D3.js Documentation**: https://d3js.org/
- **Vue 3 Composition API**: https://vuejs.org/guide/extras/composition-api-faq.html
- **Pinia Documentation**: https://pinia.vuejs.org/
- **Task Predecessor Testing Documentation**: See `Task Predecessor Testing Documentation.txt`

---

## Last Updated
**Date**: Current session
**Version**: 0.1.0 (POC)
**Status**: Basic functionality complete, ready for scaling optimizations

