from app import db


class Note(db.Model):
    __tablename__ = "notes"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.String(255), nullable=False)
    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    user = db.relationship("User", backref=db.backref("notes", lazy=True))
