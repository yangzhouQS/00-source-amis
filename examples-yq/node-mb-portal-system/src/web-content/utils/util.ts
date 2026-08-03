import dayjs from "dayjs";

export function formatDate(date: string | Date, format = "YYYY-MM-DD HH:mm:ss") {
  return dayjs(date).format(format);
}
