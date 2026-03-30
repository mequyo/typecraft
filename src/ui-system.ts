import {InputSystem} from "./input-system.ts";

type MENU = "pause-menu" | "inventory-menu" | "chest-menu";

export class UISystem {
    private stack: MENU[] = [];
    private blur: HTMLDivElement;

    public constructor() {
        this.blur = document.createElement("div");
        this.blur.style = "width: 100vw; height: 100vh; backdrop-filter: blur(10px); position: absolute; visibility: hidden;"
        document.body.appendChild(this.blur);
    }

    // Handles input and, depending on context, opens a menu or not
    public tick(input: InputSystem) {
        if (input.keypresses["p"]) {
            this.stack.includes("pause-menu") ? this.closeMenu("pause-menu") : this.openMenu("pause-menu");
        }
    }

    private openMenu(menu: MENU) {
        if (this.stack[this.stack.length - 1] == menu) return;

        this.stack.push(menu);

        const element = document.getElementById(menu);

        if (!element) throw new Error(`Menu ${menu} not found`);

        element.style.visibility = "visible";
        element.style.zIndex = this.stack.length.toString() + 1;
        this.blur.style.visibility = "visible";
    }

    public closeMenu(menu?: MENU) {
        if (menu == undefined || this.stack.length == 0) return;

        this.stack.pop();

        const element = document.getElementById(menu);

        if (!element) throw new Error(`Menu ${menu} not found`);

        element.style.visibility = "hidden";
        element.style.zIndex = "0";

        if (this.stack.length == 0) this.blur.style.visibility = "hidden";
    }

    public closeAll() {
        const menus = [...this.stack];

        for (let i = 0; i < menus.length; i++) {
            this.closeMenu(menus[i]);
        }
    }
}