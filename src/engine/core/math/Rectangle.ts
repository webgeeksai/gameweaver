/**
 * Rectangle implementation for the Game Vibe Engine
 * Provides essential rectangle operations for collision detection and rendering
 */

import { Vector2 } from './Vector2';

export class Rectangle {
  public x: number;
  public y: number;
  public width: number;
  public height: number;

  constructor(x: number = 0, y: number = 0, width: number = 0, height: number = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  // Static factory methods
  static get empty(): Rectangle {
    return new Rectangle(0, 0, 0, 0);
  }

  static fromPoints(topLeft: Vector2, bottomRight: Vector2): Rectangle {
    return new Rectangle(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y
    );
  }

  static fromCenter(center: Vector2, size: Vector2): Rectangle {
    return new Rectangle(
      center.x - size.x / 2,
      center.y - size.y / 2,
      size.x,
      size.y
    );
  }

  // Properties
  get left(): number {
    return this.x;
  }

  get right(): number {
    return this.x + this.width;
  }

  get top(): number {
    return this.y;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  get centerX(): number {
    return this.x + this.width / 2;
  }

  get centerY(): number {
    return this.y + this.height / 2;
  }

  get center(): Vector2 {
    return new Vector2(this.centerX, this.centerY);
  }

  get topLeft(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  get topRight(): Vector2 {
    return new Vector2(this.right, this.y);
  }

  get bottomLeft(): Vector2 {
    return new Vector2(this.x, this.bottom);
  }

  get bottomRight(): Vector2 {
    return new Vector2(this.right, this.bottom);
  }

  get size(): Vector2 {
    return new Vector2(this.width, this.height);
  }

  get area(): number {
    return this.width * this.height;
  }

  get perimeter(): number {
    return 2 * (this.width + this.height);
  }

  get isEmpty(): boolean {
    return this.width <= 0 || this.height <= 0;
  }

  // Instance methods
  set(x: number, y: number, width: number, height: number): Rectangle {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    return this;
  }

  copy(other: Rectangle): Rectangle {
    this.x = other.x;
    this.y = other.y;
    this.width = other.width;
    this.height = other.height;
    return this;
  }

  clone(): Rectangle {
    return new Rectangle(this.x, this.y, this.width, this.height);
  }

  setPosition(x: number, y: number): Rectangle {
    this.x = x;
    this.y = y;
    return this;
  }

  setSize(width: number, height: number): Rectangle {
    this.width = width;
    this.height = height;
    return this;
  }

  setCenter(center: Vector2): Rectangle {
    this.x = center.x - this.width / 2;
    this.y = center.y - this.height / 2;
    return this;
  }

  translate(offset: Vector2): Rectangle {
    this.x += offset.x;
    this.y += offset.y;
    return this;
  }

  scale(factor: number): Rectangle {
    const center = this.center;
    this.width *= factor;
    this.height *= factor;
    return this.setCenter(center);
  }

  inflate(amount: number): Rectangle {
    this.x -= amount;
    this.y -= amount;
    this.width += amount * 2;
    this.height += amount * 2;
    return this;
  }

  deflate(amount: number): Rectangle {
    return this.inflate(-amount);
  }

  // Collision and intersection methods
  contains(point: Vector2): boolean {
    return point.x >= this.x && 
           point.x <= this.right && 
           point.y >= this.y && 
           point.y <= this.bottom;
  }

  containsRect(other: Rectangle): boolean {
    return other.x >= this.x &&
           other.y >= this.y &&
           other.right <= this.right &&
           other.bottom <= this.bottom;
  }

  intersects(other: Rectangle): boolean {
    return !(other.x > this.right || 
             other.right < this.x || 
             other.y > this.bottom || 
             other.bottom < this.y);
  }

  intersection(other: Rectangle): Rectangle | null {
    if (!this.intersects(other)) {
      return null;
    }

    const left = Math.max(this.x, other.x);
    const top = Math.max(this.y, other.y);
    const right = Math.min(this.right, other.right);
    const bottom = Math.min(this.bottom, other.bottom);

    return new Rectangle(left, top, right - left, bottom - top);
  }

  union(other: Rectangle): Rectangle {
    const left = Math.min(this.x, other.x);
    const top = Math.min(this.y, other.y);
    const right = Math.max(this.right, other.right);
    const bottom = Math.max(this.bottom, other.bottom);

    return new Rectangle(left, top, right - left, bottom - top);
  }

  // Distance and overlap calculations
  distanceTo(other: Rectangle): number {
    if (this.intersects(other)) {
      return 0;
    }

    const dx = Math.max(0, Math.max(this.x - other.right, other.x - this.right));
    const dy = Math.max(0, Math.max(this.y - other.bottom, other.y - this.bottom));

    return Math.sqrt(dx * dx + dy * dy);
  }

  overlapArea(other: Rectangle): number {
    const intersection = this.intersection(other);
    return intersection ? intersection.area : 0;
  }

  // Utility methods
  equals(other: Rectangle, epsilon: number = 0.0001): boolean {
    return Math.abs(this.x - other.x) < epsilon &&
           Math.abs(this.y - other.y) < epsilon &&
           Math.abs(this.width - other.width) < epsilon &&
           Math.abs(this.height - other.height) < epsilon;
  }

  toString(): string {
    return `Rectangle(${this.x.toFixed(2)}, ${this.y.toFixed(2)}, ${this.width.toFixed(2)}, ${this.height.toFixed(2)})`;
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.width, this.height];
  }

  // Static utility methods
  static intersects(a: Rectangle, b: Rectangle): boolean {
    return a.intersects(b);
  }

  static intersection(a: Rectangle, b: Rectangle): Rectangle | null {
    return a.intersection(b);
  }

  static union(a: Rectangle, b: Rectangle): Rectangle {
    return a.union(b);
  }

  static fromBounds(left: number, top: number, right: number, bottom: number): Rectangle {
    return new Rectangle(left, top, right - left, bottom - top);
  }

  // Reset method for object pooling
  reset(): void {
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
  }

  // Check if this rectangle is in use (for object pooling)
  isInUse(): boolean {
    return this.width > 0 && this.height > 0;
  }
}