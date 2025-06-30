/**
 * Behaviors module exports
 */

// Movement behaviors
export { 
  PlatformerMovement,
  TopDownMovement,
  FollowBehavior
} from './MovementBehaviors';

// AI behaviors
export {
  PatrolBehavior,
  ChaseBehavior,
  StateMachineBehavior
} from './AIBehaviors';

// Visual behaviors
export {
  AnimationBehavior,
  FadeBehavior,
  FlashBehavior
} from './VisualBehaviors';

// Interaction behaviors
export {
  ClickableBehavior,
  DraggableBehavior,
  HoverableBehavior
} from './InteractionBehaviors';

// RPG behaviors
export {
  TopDownPlayerMovement,
  CameraFollow,
  InteractionSystem,
  DialogueInteraction,
  AnimationManager,
  InteractableSign,
  NPCDialogue
} from './RPGBehaviors';