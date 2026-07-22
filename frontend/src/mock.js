// app constants (this file held the design-phase mock data; live data now
// comes from the backend via api.js)

export const catStyle = {
  CLASS: 'tag',
  ACADEMIC: 'tag',
  SOCIAL: 'tag',
  IMPORTANT: 'tag warn',
  TASK: 'tag',
  SKIP: 'tag',
  OTHER: 'tag',
}

export const colorProtocol = [
  { cat: 'Classes', id: 'colorId 9', hex: '#3f51b5' },
  { cat: 'Academics', id: 'colorId 3', hex: '#8e24aa' },
  { cat: 'Social', id: 'colorId 5', hex: '#f6bf26' },
  { cat: 'Important', id: 'colorId 11', hex: '#d50000' },
  { cat: 'Not attending', id: 'colorId 8', hex: '#616161' },
  { cat: 'Everything else', id: 'colorId 7', hex: '#039be5' },
]
