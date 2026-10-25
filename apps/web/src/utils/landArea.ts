export const SQUARE_METRES_PER_ACRE = 4046.8564224;

export const toAcres = (squareMetres: number) => squareMetres / SQUARE_METRES_PER_ACRE;

export const toSquareMetres = (acres: number) => acres * SQUARE_METRES_PER_ACRE;
