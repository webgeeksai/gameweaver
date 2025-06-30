/**
 * 2D Vector implementation for the Game Vibe Engine
 * Provides essential vector operations for game mathematics
 */

export class Vector2 {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  // Static factory methods
  static get zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static get one(): Vector2 {
    return new Vector2(1, 1);
  }

  static get up(): Vector2 {
    return new Vector2(0, -1);
  }

  static get down(): Vector2 {
    return new Vector2(0, 1);
  }

  static get left(): Vector2 {
    return new Vector2(-1, 0);
  }

  static get right(): Vector2 {
    return new Vector2(1, 0);
  }

  // Instance methods
  set(x: number, y: number): Vector2 {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(other: Vector2): Vector2 {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  add(other: Vector2): Vector2 {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  subtract(other: Vector2): Vector2 {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  multiply(scalar: number): Vector2 {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  divide(scalar: number): Vector2 {
    if (scalar === 0) {
      console.warn('Vector2.divide: Division by zero');
      return this;
    }
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }

  normalize(): Vector2 {
    const magnitude = this.magnitude();
    if (magnitude === 0) {
      return this;
    }
    return this.divide(magnitude);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  distance(other: Vector2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  distanceSquared(other: Vector2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return dx * dx + dy * dy;
  }

  dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  cross(other: Vector2): number {
    return this.x * other.y - this.y * other.x;
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  angleTo(other: Vector2): number {
    return Math.atan2(other.y - this.y, other.x - this.x);
  }

  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const newX = this.x * cos - this.y * sin;
    const newY = this.x * sin + this.y * cos;
    this.x = newX;
    this.y = newY;
    return this;
  }

  lerp(other: Vector2, t: number): Vector2 {
    this.x += (other.x - this.x) * t;
    this.y += (other.y - this.y) * t;
    return this;
  }

  equals(other: Vector2, epsilon: number = 0.0001): boolean {
    return Math.abs(this.x - other.x) < epsilon && Math.abs(this.y - other.y) < epsilon;
  }

  toString(): string {
    return `Vector2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }

  // Static utility methods
  static add(a: Vector2, b: Vector2): Vector2 {
    return new Vector2(a.x + b.x, a.y + b.y);
  }

  static subtract(a: Vector2, b: Vector2): Vector2 {
    return new Vector2(a.x - b.x, a.y - b.y);
  }

  static multiply(vector: Vector2, scalar: number): Vector2 {
    return new Vector2(vector.x * scalar, vector.y * scalar);
  }

  static divide(vector: Vector2, scalar: number): Vector2 {
    if (scalar === 0) {
      console.warn('Vector2.divide: Division by zero');
      return vector.clone();
    }
    return new Vector2(vector.x / scalar, vector.y / scalar);
  }

  static normalize(vector: Vector2): Vector2 {
    const magnitude = vector.magnitude();
    if (magnitude === 0) {
      return Vector2.zero;
    }
    return Vector2.divide(vector, magnitude);
  }

  static distance(a: Vector2, b: Vector2): number {
    return a.distance(b);
  }

  static distanceSquared(a: Vector2, b: Vector2): number {
    return a.distanceSquared(b);
  }

  static dot(a: Vector2, b: Vector2): number {
    return a.dot(b);
  }

  static cross(a: Vector2, b: Vector2): number {
    return a.cross(b);
  }

  static lerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return new Vector2(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t
    );
  }

  static fromAngle(angle: number, magnitude: number = 1): Vector2 {
    return new Vector2(
      Math.cos(angle) * magnitude,
      Math.sin(angle) * magnitude
    );
  }

  static random(): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    return Vector2.fromAngle(angle);
  }

  static clamp(vector: Vector2, min: Vector2, max: Vector2): Vector2 {
    return new Vector2(
      Math.max(min.x, Math.min(max.x, vector.x)),
      Math.max(min.y, Math.min(max.y, vector.y))
    );
  }

  static negate(vector: Vector2): Vector2 {
    return new Vector2(-vector.x, -vector.y);
  }

  // Reset method for object pooling
  reset(): void {
    this.x = 0;
    this.y = 0;
  }

  // Check if this vector is in use (for object pooling)
  isInUse(): boolean {
    return this.x !== 0 || this.y !== 0;
  }
}