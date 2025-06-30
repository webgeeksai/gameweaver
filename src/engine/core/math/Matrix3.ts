/**
 * 3x3 Matrix implementation for 2D transformations
 * Used for transform hierarchies and rendering calculations
 */

import { Vector2 } from './Vector2';

export class Matrix3 {
  // Matrix stored in column-major order for WebGL compatibility
  public elements: Float32Array;

  constructor() {
    this.elements = new Float32Array(9);
    this.identity();
  }

  // Static factory methods
  static get identity(): Matrix3 {
    return new Matrix3();
  }

  static fromTransform(position: Vector2, rotation: number, scale: Vector2): Matrix3 {
    const matrix = new Matrix3();
    return matrix.setTransform(position, rotation, scale);
  }

  static fromTranslation(translation: Vector2): Matrix3 {
    const matrix = new Matrix3();
    return matrix.setTranslation(translation);
  }

  static fromRotation(rotation: number): Matrix3 {
    const matrix = new Matrix3();
    return matrix.setRotation(rotation);
  }

  static fromScale(scale: Vector2): Matrix3 {
    const matrix = new Matrix3();
    return matrix.setScale(scale);
  }

  // Matrix operations
  identity(): Matrix3 {
    const e = this.elements;
    e[0] = 1; e[3] = 0; e[6] = 0;
    e[1] = 0; e[4] = 1; e[7] = 0;
    e[2] = 0; e[5] = 0; e[8] = 1;
    return this;
  }

  copy(other: Matrix3): Matrix3 {
    this.elements.set(other.elements);
    return this;
  }

  clone(): Matrix3 {
    const matrix = new Matrix3();
    return matrix.copy(this);
  }

  set(
    m00: number, m01: number, m02: number,
    m10: number, m11: number, m12: number,
    m20: number, m21: number, m22: number
  ): Matrix3 {
    const e = this.elements;
    e[0] = m00; e[3] = m01; e[6] = m02;
    e[1] = m10; e[4] = m11; e[7] = m12;
    e[2] = m20; e[5] = m21; e[8] = m22;
    return this;
  }

  // Transform setters
  setTranslation(translation: Vector2): Matrix3 {
    this.identity();
    this.elements[6] = translation.x;
    this.elements[7] = translation.y;
    return this;
  }

  setRotation(rotation: number): Matrix3 {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    
    return this.set(
      cos, -sin, 0,
      sin,  cos, 0,
        0,    0, 1
    );
  }

  setScale(scale: Vector2): Matrix3 {
    return this.set(
      scale.x,       0, 0,
            0, scale.y, 0,
            0,       0, 1
    );
  }

  setTransform(position: Vector2, rotation: number, scale: Vector2): Matrix3 {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    
    return this.set(
      cos * scale.x, -sin * scale.y, position.x,
      sin * scale.x,  cos * scale.y, position.y,
                  0,              0,         1
    );
  }

  // Matrix multiplication
  multiply(other: Matrix3): Matrix3 {
    const a = this.elements;
    const b = other.elements;
    const result = new Float32Array(9);

    result[0] = a[0] * b[0] + a[3] * b[1] + a[6] * b[2];
    result[3] = a[0] * b[3] + a[3] * b[4] + a[6] * b[5];
    result[6] = a[0] * b[6] + a[3] * b[7] + a[6] * b[8];

    result[1] = a[1] * b[0] + a[4] * b[1] + a[7] * b[2];
    result[4] = a[1] * b[3] + a[4] * b[4] + a[7] * b[5];
    result[7] = a[1] * b[6] + a[4] * b[7] + a[7] * b[8];

    result[2] = a[2] * b[0] + a[5] * b[1] + a[8] * b[2];
    result[5] = a[2] * b[3] + a[5] * b[4] + a[8] * b[5];
    result[8] = a[2] * b[6] + a[5] * b[7] + a[8] * b[8];

    this.elements.set(result);
    return this;
  }

  premultiply(other: Matrix3): Matrix3 {
    return this.copy(other).multiply(this);
  }

  // Transform operations
  translate(translation: Vector2): Matrix3 {
    const translationMatrix = Matrix3.fromTranslation(translation);
    return this.multiply(translationMatrix);
  }

  rotate(rotation: number): Matrix3 {
    const rotationMatrix = Matrix3.fromRotation(rotation);
    return this.multiply(rotationMatrix);
  }

  scale(scale: Vector2): Matrix3 {
    const scaleMatrix = Matrix3.fromScale(scale);
    return this.multiply(scaleMatrix);
  }

  // Vector transformation
  transformPoint(point: Vector2): Vector2 {
    const e = this.elements;
    const x = point.x;
    const y = point.y;

    return new Vector2(
      e[0] * x + e[3] * y + e[6],
      e[1] * x + e[4] * y + e[7]
    );
  }

  transformVector(vector: Vector2): Vector2 {
    const e = this.elements;
    const x = vector.x;
    const y = vector.y;

    return new Vector2(
      e[0] * x + e[3] * y,
      e[1] * x + e[4] * y
    );
  }

  // Matrix properties
  determinant(): number {
    const e = this.elements;
    return e[0] * (e[4] * e[8] - e[7] * e[5]) -
           e[3] * (e[1] * e[8] - e[7] * e[2]) +
           e[6] * (e[1] * e[5] - e[4] * e[2]);
  }

  invert(): Matrix3 {
    const e = this.elements;
    const det = this.determinant();

    if (Math.abs(det) < 1e-10) {
      console.warn('Matrix3.invert: Matrix is not invertible');
      return this.identity();
    }

    const invDet = 1 / det;

    const result = new Float32Array(9);

    result[0] = (e[4] * e[8] - e[7] * e[5]) * invDet;
    result[3] = (e[6] * e[5] - e[3] * e[8]) * invDet;
    result[6] = (e[3] * e[7] - e[6] * e[4]) * invDet;

    result[1] = (e[7] * e[2] - e[1] * e[8]) * invDet;
    result[4] = (e[0] * e[8] - e[6] * e[2]) * invDet;
    result[7] = (e[6] * e[1] - e[0] * e[7]) * invDet;

    result[2] = (e[1] * e[5] - e[4] * e[2]) * invDet;
    result[5] = (e[3] * e[2] - e[0] * e[5]) * invDet;
    result[8] = (e[0] * e[4] - e[3] * e[1]) * invDet;

    this.elements.set(result);
    return this;
  }

  transpose(): Matrix3 {
    const e = this.elements;
    const result = new Float32Array(9);

    result[0] = e[0]; result[3] = e[1]; result[6] = e[2];
    result[1] = e[3]; result[4] = e[4]; result[7] = e[5];
    result[2] = e[6]; result[5] = e[7]; result[8] = e[8];

    this.elements.set(result);
    return this;
  }

  // Decomposition
  getTranslation(): Vector2 {
    return new Vector2(this.elements[6], this.elements[7]);
  }

  getRotation(): number {
    return Math.atan2(this.elements[1], this.elements[0]);
  }

  getScale(): Vector2 {
    const scaleX = Math.sqrt(this.elements[0] * this.elements[0] + this.elements[1] * this.elements[1]);
    const scaleY = Math.sqrt(this.elements[3] * this.elements[3] + this.elements[4] * this.elements[4]);
    return new Vector2(scaleX, scaleY);
  }

  // Utility methods
  equals(other: Matrix3, epsilon: number = 1e-6): boolean {
    const a = this.elements;
    const b = other.elements;

    for (let i = 0; i < 9; i++) {
      if (Math.abs(a[i] - b[i]) > epsilon) {
        return false;
      }
    }

    return true;
  }

  toString(): string {
    const e = this.elements;
    return `Matrix3(\n` +
           `  ${e[0].toFixed(3)}, ${e[3].toFixed(3)}, ${e[6].toFixed(3)}\n` +
           `  ${e[1].toFixed(3)}, ${e[4].toFixed(3)}, ${e[7].toFixed(3)}\n` +
           `  ${e[2].toFixed(3)}, ${e[5].toFixed(3)}, ${e[8].toFixed(3)}\n` +
           `)`;
  }

  toArray(): number[] {
    return Array.from(this.elements);
  }

  // Static utility methods
  static multiply(a: Matrix3, b: Matrix3): Matrix3 {
    return a.clone().multiply(b);
  }

  static invert(matrix: Matrix3): Matrix3 {
    return matrix.clone().invert();
  }

  static transpose(matrix: Matrix3): Matrix3 {
    return matrix.clone().transpose();
  }

  // Reset method for object pooling
  reset(): void {
    this.identity();
  }

  // Check if this matrix is in use (for object pooling)
  isInUse(): boolean {
    const e = this.elements;
    return !(e[0] === 1 && e[1] === 0 && e[2] === 0 &&
             e[3] === 0 && e[4] === 1 && e[5] === 0 &&
             e[6] === 0 && e[7] === 0 && e[8] === 1);
  }
}