import { defineStore } from 'pinia'

export const useTasksStore = defineStore('tasksStore', {
  state: () => ({
    tasks: [
      // 🟪 Design
      {
        id: 1,
        title: 'Wireframes',
        category: 'Design',
        color: '#A78BFA',
        start: '2025-11-01T09:00',
        end: '2025-11-01T23:00'
      },
      {
        id: 2,
        title: 'Mockups',
        category: 'Design',
        color: '#A78BFA',
        start: '2025-11-02T10:00',
        end: '2025-11-03T16:00',
        predecessor: {
          taskId: 1,
          type: 'FS',
          lag: 0
        }
      },
      {
        id: 3,
        title: 'Prototypes',
        category: 'Design',
        color: '#A78BFA',
        start: '2025-11-03T09:00',
        end: '2025-11-04T11:00'
      },
      // 🟩 Development
      {
        id: 4,
        title: 'API Setup',
        category: 'Development',
        color: '#2DD4BF',
        start: '2025-11-02T09:00',
        end: '2025-11-04T18:00'
      },
      {
        id: 5,
        title: 'Frontend Components',
        category: 'Development',
        color: '#2DD4BF',
        start: '2025-11-03T10:00',
        end: '2025-11-05T17:00'
      },
      {
        id: 6,
        title: 'Integration',
        category: 'Development',
        color: '#2DD4BF',
        start: '2025-11-04T12:00',
        end: '2025-11-06T16:00'
      },
      // 🟦 QA
      {
        id: 7,
        title: 'Unit Testing',
        category: 'QA',
        color: '#F472B6',
        start: '2025-11-05T09:00',
        end: '2025-11-05T23:00'
      },
      {
        id: 8,
        title: 'Integration Testing',
        category: 'QA',
        color: '#F472B6',
        start: '2025-11-05T15:00',
        end: '2025-11-06T22:00'
      },
      // 🟧 Deployment
      {
        id: 9,
        title: 'Staging Setup',
        category: 'Deployment',
        color: '#7C3AED',
        start: '2025-11-06T09:00',
        end: '2025-11-06T23:00'
      },
      {
        id: 10,
        title: 'Production Release',
        category: 'Deployment',
        color: '#7C3AED',
        start: '2025-11-07T01:00',
        end: '2025-11-07T18:00'
      }
    ],
    dependencies: [],
    
  }),
  getters: {
    allTasks: (state) => state.tasks
  },

  actions: {
    updateTaskTime(id, newStart, newEnd) {
      console.log("=== updateTaskTime called ===");
      console.log("Task ID:", id);
      console.log("New start:", newStart);
      console.log("New end:", newEnd);
      const task = this.tasks.find((t) => t.id === id)
      if (!task) {
        console.error("Task not found with ID:", id);
        return
      }
      console.log("Task found:", task.title);
      console.log("Old start:", task.start);
      console.log("Old end:", task.end);
      if (newStart) task.start = newStart
      if (newEnd) task.end = newEnd
      console.log("Task dates updated:", {
        start: task.start,
        end: task.end
      });
    },
    setPredecessor(taskId, predecessor) {
      const task = this.tasks.find((t) => t.id === taskId)
      if (!task) return
      task.predecessor = predecessor
    },
    updatePredecessorLag(taskId, lag) {
      const task = this.tasks.find((t) => t.id === taskId)
      if (!task || !task.predecessor) return
      task.predecessor.lag = lag
    },
    removePredecessor(taskId) {
      const task = this.tasks.find((t) => t.id === taskId)
      if (!task) return
      task.predecessor = null
    },
    // Legacy methods for backward compatibility with visualization
    addDependency(dependency) {
      // Check if dependency already exists
      const exists = this.dependencies.some(
        (dep) =>
          dep.from === dependency.from &&
          dep.to === dependency.to &&
          dep.fromType === dependency.fromType &&
          dep.toType === dependency.toType
      )
      if (!exists) {
        this.dependencies.push(dependency)
      }
    },
    removeDependency(dependency) {
      const index = this.dependencies.findIndex(
        (dep) =>
          dep.from === dependency.from &&
          dep.to === dependency.to &&
          dep.fromType === dependency.fromType &&
          dep.toType === dependency.toType
      )
      if (index > -1) {
        this.dependencies.splice(index, 1)
      }
    }
  }
})
