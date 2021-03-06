(function () {
    var Land = window.Land = function () {
        // 取得大地图片对象
        this.image = game.R.land;

        this.x = 0;
        this.y = game.canvas.height * 0.76;

        this.width = 336;
        this.height = 112;
        // 大地离得近，速度应该快一些
        this.speed = 2;
    }

    Land.prototype.render = function () {
        game.ctx.drawImage(this.image, this.x, this.y);
        game.ctx.drawImage(this.image, this.x + this.width, this.y);
        game.ctx.drawImage(this.image, this.x + this.width * 2, this.y);

        game.ctx.fillStyle = "#DED895";
        // 防止边界露馅，+5多绘制5px
        game.ctx.fillRect(0, this.y + this.height - 5, game.canvas.width, game.canvas.height * 0.24 - this.height + 5);
    }

    Land.prototype.update = function () {
        this.x -= this.speed;
        // 无限连续滚动，把图片拉回来
        if (this.x < -this.width) {
            this.x = 0;
        }
    }
})()