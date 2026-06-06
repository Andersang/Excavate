import { createRouter, createMemoryHistory } from 'vue-router'
import { type Component } from 'vue'
import { Search, Library, Bookmark, Settings, Info } from 'lucide-vue-next'

export interface RouteMetadata extends Record<PropertyKey, unknown> {
  icon: Component
  label: string
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      name: 'Base',
      component: () => import('@/views/Base.vue'),
      meta: {
        icon: Search,
        label: 'Search'
      } as RouteMetadata
    },
    {
      path: '/library',
      name: 'Library',
      component: () => import('@/views/Library.vue'),
      meta: {
        icon: Library,
        label: 'Library'
      } as RouteMetadata
    },
    {
      path: '/bookmarks',
      name: 'Bookmarks',
      component: () => import('@/views/Bookmarks.vue'),
      meta: {
        icon: Bookmark,
        label: 'Bookmarks'
      } as RouteMetadata
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue'),
      meta: {
        icon: Settings,
        label: 'Settings'
      } as RouteMetadata
    },
    {
      path: '/about',
      name: 'About',
      component: () => import('@/views/About.vue'),
      meta: {
        icon: Info,
        label: 'About'
      } as RouteMetadata
    }
  ]
})

export default router
