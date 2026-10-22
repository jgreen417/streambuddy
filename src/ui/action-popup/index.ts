import "@fontsource-variable/bricolage-grotesque/opsz.css"
import { i18n } from "@/composables/useLocale"
import { pinia } from "@/utils/pinia"
import { appRouter } from "@/utils/router"
import { createApp } from "vue"
import App from "./app.vue"

appRouter.addRoute({
	path: "/",
	redirect: "/action-popup",
})

const app = createApp(App).use(i18n).use(pinia).use(appRouter)

app.mount("#app")

export default app
