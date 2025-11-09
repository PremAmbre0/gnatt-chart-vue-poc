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
        end: '2025-11-03T16:00'
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
      const task = this.tasks.find((t) => t.id === id)
      if (!task) return
      if (newStart) task.start = newStart
      if (newEnd) task.end = newEnd
    }
  }
})
