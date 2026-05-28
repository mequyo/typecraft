Number.prototype.memory = function (unit?: "B" | "KB" | "MB" | "GB"): string {
  const bytes = this.valueOf();

  if (unit == undefined) {
    unit = "GB";
    if (bytes < 1_000_000_000) unit = "MB";
    if (bytes < 1_000_000) unit = "KB";
    if (bytes < 1_000) unit = "B";
  }

  switch (unit) {
    case "B":
      return bytes.toString();
    case "KB":
      return (bytes / 1_000).toFixed(1).concat("KB");
    case "MB":
      return (bytes / 1_000_000).toFixed(1).concat("MB");
    case "GB":
      return (bytes / 1_000_000_000).toFixed(1).concat("GB");
  }
};

Number.prototype.percent = function (digits: number): string {
  return `${(this.valueOf() * 100).toFixed(digits)}%`;
};

Number.prototype.time = function (
  type: "ss" | "mm" | "hh" | "mm:ss" | "hh:mm" | "hh:mm:ss",
): string {
  const total = Math.floor(this.valueOf());
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const seconds = s.toString().padStart(2, "0");
  const minutes = m.toString().padStart(2, "0");
  const hours = h.toString().padStart(2, "0");

  switch (type) {
    case "ss":
      return seconds;
    case "mm":
      return minutes;
    case "hh":
      return hours;
    case "mm:ss":
      return `${minutes}:${seconds}`;
    case "hh:mm":
      return `${hours}:${minutes}`;
    case "hh:mm:ss":
      return `${hours}:${minutes}:${seconds}`;
  }
};
