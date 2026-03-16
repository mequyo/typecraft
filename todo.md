System                    Responsibility

InputSystem               Raw input → intent (jump: bool, move: vec2, place: bool)
PhysicsSystem             Gravity, velocity integration, stepwise AABB resolution
PlayerSystem              Consumes input intent + physics result → jump, block place, etc.
WorldSystem               Mutation of the world (actually placing/breaking blocks)