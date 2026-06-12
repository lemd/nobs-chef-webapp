import { createRouter, createWebHistory } from 'vue-router';
import DashView from './views/DashView.vue';
import NewView from './views/NewView.vue';
import RecipeView from './views/RecipeView.vue';
import LoginView from './views/LoginView.vue';

export default createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', name: 'dash', component: DashView },
        { path: '/new', name: 'new', component: NewView },
        {
            path: '/r/:slug',
            name: 'recipe',
            component: RecipeView,
            props: true,
        },
        { path: '/login', name: 'login', component: LoginView },
        { path: '/join', name: 'join', component: LoginView }, // placeholder for book-join flow
    ],
});
