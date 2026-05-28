export class NumberUtils {
  static memory(num: number, unit?: "B" | "KB" | "MB" | "GB"): string {
    const bytes = num.valueOf();

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
  }

  static percent(num: number, digits: number): string {
    return `${(num.valueOf() * 100).toFixed(digits)}%`;
  }

  static time(
    num: number | undefined,
    type: "ss" | "mm" | "hh" | "mm:ss" | "hh:mm" | "hh:mm:ss",
  ): string {
    const total = Math.floor(num?.valueOf() || 0);
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
  }
}
