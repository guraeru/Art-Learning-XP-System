from app import app, db
from models import User

with app.app_context():
    admin = User.query.filter_by(username='admin').first()
    if not admin:
        admin = User(username='admin', is_admin=True)
        admin.set_password('admin')
        db.session.add(admin)
        db.session.commit()
        print('初期ユーザー admin/admin を作成しました')
    else:
        print('adminユーザーは既に存在します')
