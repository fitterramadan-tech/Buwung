// script.js
// Phaser 3 Flappy Bird - single player, images made from SVG data URLs at runtime.
// Controls: Spacebar or pointer/tap to flap.

window.addEventListener('load', () => {
  const WIDTH = 420;
  const HEIGHT = 640;
  const PIPE_VELOCITY = -200;
  const PIPE_INTERVAL = 1500; // ms
  const GAP_SIZE = 140; // gap between top and bottom pipes
  const BIRD_X = 100;

  class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }
    preload() {
      // Create SVGs and register as data URLs (encodeURIComponent)
      const birdSvg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='48' height='36' viewBox='0 0 48 36'>
          <circle cx='18' cy='18' r='12' fill='%23FFD54F' stroke='%23A57C12' stroke-width='2'/>
          <ellipse cx='26' cy='22' rx='6' ry='4' fill='%23FF8A65' />
          <circle cx='16' cy='16' r='3' fill='%23000' />
          <path d='M30 12 q8 2 10 0 q-2 -6 -10 -4 z' fill='%23FF7043' opacity='0.95'/>
        </svg>`;
      const pipeSvg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='96' height='512' viewBox='0 0 96 512'>
          <rect x='0' y='0' width='96' height='512' fill='%2332CD32' />
          <rect x='0' y='0' width='96' height='28' fill='%232E8B57' />
          <rect x='0' y='484' width='96' height='28' fill='%232E8B57' />
          <rect x='8' y='8' width='80' height='24' fill='%23000000' opacity='0.06' />
        </svg>`;
      const bgSvg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='420' height='640' viewBox='0 0 420 640'>
          <defs>
            <linearGradient id='g' x1='0' x2='0' y1='0' y2='1'>
              <stop offset='0' stop-color='%23b3e5fc'/>
              <stop offset='1' stop-color='%2387ceeb'/>
            </linearGradient>
          </defs>
          <rect width='420' height='640' fill='url(%23g)'/>
          <!-- simple clouds -->
          <ellipse cx='80' cy='90' rx='60' ry='28' fill='white' opacity='0.9'/>
          <ellipse cx='140' cy='70' rx='38' ry='20' fill='white' opacity='0.9'/>
          <ellipse cx='300' cy='120' rx='70' ry='30' fill='white' opacity='0.85'/>
          <!-- distant ground -->
          <rect x='0' y='560' width='420' height='80' fill='%2333cc66' />
        </svg>`;

      // helper to data URL
      const toDataUrl = svg => 'data:image/svg+xml;charset=utf8,' + encodeURIComponent(svg);

      this.load.image('bg', toDataUrl(bgSvg));
      this.load.image('bird', toDataUrl(birdSvg));
      this.load.image('pipe', toDataUrl(pipeSvg));
    }

    create() {
      // background
      this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'bg')
        .setOrigin(0)
        .setScrollFactor(0);

      // physics world
      this.physics.world.setBounds(0, 0, WIDTH, HEIGHT);

      // bird
      this.bird = this.physics.add.sprite(BIRD_X, HEIGHT / 2, 'bird');
      this.bird.setOrigin(0.5);
      this.bird.setCollideWorldBounds(true);
      this.bird.body.setGravityY(900);
      this.bird.setScale(0.9);

      // group of pipes
      this.pipes = this.physics.add.group();
      this.pipeTimer = this.time.addEvent({
        delay: PIPE_INTERVAL,
        loop: true,
        callback: this.spawnPipes,
        callbackScope: this
      });

      // score
      this.score = 0;
      this.scoreText = this.add.text(WIDTH/2, 24, '0', {
        fontFamily: 'Arial',
        fontSize: '36px',
        color: '#fff',
        stroke: '#000',
        strokeThickness: 6
      }).setOrigin(0.5, 0);

      // collisions
      this.physics.add.overlap(this.bird, this.pipes, this.hitPipe, null, this);

      // controls: spacebar and pointer
      this.input.keyboard.on('keydown-SPACE', this.flap, this);
      this.input.on('pointerdown', this.flap, this);

      // game state
      this.isGameOver = false;

      // show hint
      this.hint = this.add.text(WIDTH/2, HEIGHT - 100,
        'Tekan SPACE atau ketuk layar untuk flap', {
          font: '16px Arial',
          fill: '#fff',
          stroke: '#000',
          strokeThickness: 4
        }).setOrigin(0.5);

      // start with a first pipe spawn after short delay
      this.time.delayedCall(400, () => this.spawnPipes(), [], this);
    }

    flap() {
      if (this.isGameOver) {
        this.restartGame();
        return;
      }
      this.bird.body.velocity.y = -350;
      // small tilt animation
      this.tweens.add({
        targets: this.bird,
        angle: -20,
        duration: 80,
        yoyo: true,
        ease: 'Power1'
      });
    }

    spawnPipes() {
      if (this.isGameOver) return;
      const gap = GAP_SIZE;
      const topMin = 50;
      const bottomMin = 50;

      // choose position of gap center
      const gapY = Phaser.Math.Between(topMin + gap/2, this.sys.game.config.height - bottomMin - gap/2);

      // top pipe (inverted)
      const topPipe = this.pipes.create(WIDTH + 48, gapY - gap/2 - 256, 'pipe');
      topPipe.setOrigin(0.5, 1);
      topPipe.body.allowGravity = false;
      topPipe.setVelocityX(PIPE_VELOCITY);
      topPipe.flipY = true;

      // bottom pipe
      const botPipe = this.pipes.create(WIDTH + 48, gapY + gap/2 + 256 - 512, 'pipe');
      // we will adjust displayHeight to make pipes long enough
      botPipe.setOrigin(0.5, 0);
      botPipe.body.allowGravity = false;
      botPipe.setVelocityX(PIPE_VELOCITY);

      // Tag pipes for scoring when they pass the bird
      topPipe.passed = false;
      botPipe.passed = false;

      // Adjust sizes so they fill top/bottom properly by using setDisplaySize
      // We'll compute required heights for top and bottom so that gap is at gapY.
      const pipeTextureHeight = 512; // original pipe svg height
      // calculate top pipe display height so bottom of top pipe is gapY - gap/2
      const topDisplayHeight = gapY - gap/2; // pixels from top
      const botDisplayHeight = this.sys.game.config.height - (gapY + gap/2); // bottom part height

      // but ensure minimums
      topPipe.setDisplaySize(96, Math.max(48, topDisplayHeight));
      topPipe.y = topDisplayHeight; // anchor bottom at topDisplayHeight (since origin y=1)
      botPipe.setDisplaySize(96, Math.max(48, botDisplayHeight));
      botPipe.y = gapY + gap/2; // origin y=0 so position is top of bottom pipe

      // cleanup pipes when off-screen
      topPipe.checkWorldBounds = true;
      botPipe.checkWorldBounds = true;
      topPipe.outOfBoundsKill = true;
      botPipe.outOfBoundsKill = true;
    }

    hitPipe() {
      if (this.isGameOver) return;
      this.gameOver();
    }

    gameOver() {
      this.isGameOver = true;
      this.bird.setTint(0xff0000);
      this.bird.body.allowGravity = false;
      this.bird.body.velocity.y = 0;
      this.pipes.children.iterate(p => {
        p.setVelocityX(0);
      });
      this.pipeTimer.paused = true;
      this.hint.setText('GAME OVER - Ketuk layar atau tekan SPACE untuk restart');

      this.add.text(this.sys.game.config.width/2, this.sys.game.config.height/2 - 40,
        'GAME OVER', {
          fontSize: '48px',
          fontFamily: 'Arial',
          stroke: '#000',
          strokeThickness: 8,
          color: '#fff'
        }).setOrigin(0.5);

      this.add.text(this.sys.game.config.width/2, this.sys.game.config.height/2 + 16,
        `Skor: ${this.score}`, {
          fontSize: '28px',
          fontFamily: 'Arial',
          stroke: '#000',
          strokeThickness: 6,
          color: '#fff'
        }).setOrigin(0.5);
    }

    restartGame() {
      // destroy pipes and reset bird
      this.pipes.clear(true, true);
      this.score = 0;
      this.scoreText.setText('0');
      this.isGameOver = false;
      this.bird.clearTint();
      this.bird.setPosition(BIRD_X, this.sys.game.config.height / 2);
      this.bird.body.allowGravity = true;
      this.bird.body.setVelocity(0, 0);
      this.pipeTimer.paused = false;
      this.hint.setText('Tekan SPACE atau ketuk layar untuk flap');
      // remove any Game Over texts by restarting scene visuals:
      this.children.each(child => {
        if (child.type === 'Text' && child.text && (child.text.includes('GAME OVER') || child.text.startsWith('Skor:'))) {
          child.destroy();
        }
      });
    }

    update(time, delta) {
      if (!this.isGameOver) {
        // rotate bird based on velocity
        const vy = this.bird.body.velocity.y;
        this.bird.angle = Phaser.Math.Clamp(vy / 6, -30, 90);

        // scoring: when a pipe pair passes the bird, increase score
        this.pipes.children.iterate(pipe => {
          if (!pipe) return;
          // since pipes are two separate sprites, only count when a top pipe passes
          if (!pipe.passed && pipe.x + pipe.displayWidth/2 < this.bird.x && !pipe.flipY) {
            // choose to mark the bottom pipe as scorer
            pipe.passed = true;
            this.score += 1;
            this.scoreText.setText(String(this.score));
          }
          // Remove pipes that are completely off screen to free memory
          if (pipe.x + pipe.displayWidth < -50) {
            pipe.destroy();
          }
        });

        // world bounds check: if bird hits top or bottom
        if (this.bird.y >= this.sys.game.config.height - 4 || this.bird.y <= 4) {
          this.gameOver();
        }
      }
    }
  }

  const config = {
    type: Phaser.AUTO,
    width: WIDTH,
    height: HEIGHT,
    parent: 'game-container',
    backgroundColor: 0x87ceeb,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scene: [ MainScene ]
  };

  new Phaser.Game(config);
});
