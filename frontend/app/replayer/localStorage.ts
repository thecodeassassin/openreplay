function number(key: string): number {
  return parseInt(localStorage.getItem(key) || "")
}

function bool(key: string): boolean {
  return localStorage.getItem(key) === 'true'
}

function setItem(key:string, val: any) {
   localStorage.setItem(key, String(val))
}