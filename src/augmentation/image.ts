HTMLImageElement.prototype.load = function (url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        if (this.complete && this.naturalWidth !== 0) {
            resolve(this);
            return;
        }

        this.addEventListener("load", () => resolve(this), { once: true });
        this.addEventListener("error", () => reject(new Error(`Failed to load image: ${url}`)), { once: true });

        this.src = url;
    });
};



HTMLImageElement.prototype.average = function (): [number, number, number, number] {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");

    ctx.drawImage(this, 0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;

    return [data[0], data[1], data[2], data[3]];
};
