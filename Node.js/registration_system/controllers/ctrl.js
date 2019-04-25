const formidable = require("formidable");
const xlsx = require("node-xlsx");
const path = require("path");
const fs = require("fs");
const format = require('date-format');
const Student = require("../models/Student.js");
const Course = require("../models/Course.js");


exports.showIndex = (req, res) => {
    res.render("admin/index", { "current": "index" });
}
// 学生列表页面
exports.showStudent = (req, res) => {
    res.render("admin/student", { "current": "student" });
}
// 给前端提供学生列表的数据
// 请求参数：排序主键sid、当前页条数rows、页码page、排序方式
// 页面载入和换页都会发起请求，就是后端分页
exports.doShowStudent = (req, res) => {
    var form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
        // 从前端请求中拿到参数
        var rows = parseInt(fields.rows); //限制行数
        var page = fields.page; //当前页
        var sortobj = {};
        sortobj[fields.sidx] = fields.sord; //排序方式

        // 删除：通过_id找到目标数据，删除，从前端请求中拿到_id
        if (fields.oper === "del") {
            var idArr = fields.id.split(",");

            idArr.forEach((id) => {
                Student.deleteOne({ "_id": id }, (err, info) => {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    // 删除结果
                    console.log(info);
                })
            })
        }

        // 修改：通过_id找到目标，修改
        if (fields.oper === "edit") {
            // 检查学号是否重复
            Student.find({ "_id": fields.id }, (err, thisStu) => {

                Student.find({ "sid": fields.sid }, (err, results) => {
                    // 查找fields.sid如果为0，或者sid不变说明学号不重复，否则学号重复，在学号单元格内提示
                    if (!(results.length === 0 || fields.sid === thisStu[0].sid)) {
                        fields.sid = "0学号" + fields.sid + "被占用,请修改";
                    }

                    Student.updateOne({ "_id": fields.id }, { "sid": fields.sid, "name": fields.name, "sex": fields.sex, "grade": fields.grade, "password.pwd": fields['password.pwd'], "password.isInitial": fields['password.isInitial'] }, { multi: true }, (err, info) => {
                        if (err) {
                            console.log(err);
                            return;
                        }
                        console.log(info);
                    })
                })
            })
        }

        // 增加
        if (fields.oper === "add") {
            // 检查学号是否重复
            Student.find({ "sid": fields.sid }, (err, results) => {
                if (results.length > 0) {
                    fields.sid += "0学号" + fields.sid + "被占用,请修改";
                }
                if (fields.sid === "" || fields.name === "") {
                    fields.sid += "0学号、姓名漏填了请修改";
                }
                // _id在数据库中自动生成，前端提交之后jqGrid立即拉取数据获得_id，密码初始化为学号
                Student.create({ "sid": fields.sid, "name": fields.name, "sex": fields.sex, "grade": fields.grade, "password.pwd": fields.sid, "password.isInitial": fields['password.isInitial'] }, (err, info) => {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    console.log(fields);
                });
            })
        }

        // 查询
        var searchObj = {};// 查询条件
        if (fields._search === "true") {
            var searchField = fields.searchField;
            var searchString = fields.searchString;
            // 用正则做模糊查询，找含有searchString的文档
            var reg = new RegExp(searchString, "g");
            searchObj[searchField] = reg;
        }

        Student.countDocuments(searchObj, function (err, count) {
            var totalpages = Math.ceil(count / rows); //总页数
            // 导出Excel
            if (fields.oper === "download") {
                var TableR = [];
                var gradeArr = ["初一", "初二", "初三", "高一", "高二", "高三"];
                //迭代器！强行把异步函数变为同步的！当读取完毕初一的时候，才去读取初二……
                //i为0、1、2、3、4、5，表示读取初一、初二……高三的信息
                function iterator(i) {
                    if (i == 6) {
                        //此时TableR中已经是6个年级的大数组了！
                        var buffer = xlsx.build(TableR);
                        //生成文件
                        var dateStr = format.asString("yyyy-MM-dd-hh-mm-ss.SSS", new Date());
                        var filePath = "/download/学生名单" + dateStr + ".xlsx";
                        fs.writeFile("./public" + filePath, buffer, (err) => {
                            if (err) {
                                res.send("文件写入失败");
                            }
                            console.log("ok");

                            res.send(filePath);
                        });
                    }
                    //整理数据
                    Student.find({ "grade": gradeArr[i] }, (err, results) => {
                        // sheetR子表，每个子表表示一个年级，先放一个表头
                        var sheetR = [["学号", "姓名", "性别", "密码", "是初始密码？"]];
                        results.forEach((item) => {
                            // 每一列的数据，"学号", "姓名", "性别", "密码", "是初始密码？" 按照这个顺序推入数组
                            sheetR.push([
                                item.sid,
                                item.name,
                                item.sex,
                                item.password.pwd,
                                item.password.isInitial
                            ]);
                        });
                        // name年级，data对应年级的数据
                        TableR.push({ "name": gradeArr[i], data: sheetR });

                        iterator(++i);
                    });
                }

                iterator(0);
            } else {
                // 分页
                Student.find(searchObj).sort(sortobj).limit(rows).skip(rows * (page - 1)).exec((err, results) => {
                    // 返回数据格式
                    // console.log(results[0])
                    res.json({
                        "totalpages": totalpages,
                        "currpage": page,
                        "totalrecords": count,
                        "rows": results,
                        "id": "sid",
                        "cell": ["sid", "name", "sex", "grade", "password.pwd", "password.isInitial"]
                    });
                });
            }
        });
    });
}
// 显示导入学生名单页面
exports.showStudentImport = (req, res) => {
    // 第二个参数用于给sidebar加class
    res.render("admin/stuImport", { "current": "student" });
}
// 上传文件，导入学生名单
exports.doStudentImport = (req, res) => {
    var form = new formidable.IncomingForm();
    // 指定上传文件夹
    form.uploadDir = "./uploads";
    //保留文件后缀
    form.keepExtensions = true;
    form.parse(req, (err, fields, files) => {
        if (err) {
            res.send("上传失败，请重新上传");
        }
        // 检查文件，如果是空文件或者其他格式文件，提醒用户重新上传studentExcel，文件提交控件的name属性studentExcel
        // console.log(files.studentExcel.path);
        if (files.studentExcel.size === 0 || path.extname(files.studentExcel.path) != ".xlsx") {
            //删除文件
            fs.unlink("./" + files.studentExcel.path, function (err) {
                if (err) {
                    console.log("删除文件错误");
                    return;
                }
                res.send("文件无效，请重新上传");
            });
            return;
        }

        // 读取excel表格，转为数组，length表示子表格数量
        var stuArr = xlsx.parse("./" + files.studentExcel.path);
        // 检查表格表头是否正确
        var sidArr = [];
        for (var grade = 0; grade < stuArr.length; grade++) {
            if (stuArr[grade].data[0][0] != "学号" || stuArr[grade].data[0][1] != "姓名" || stuArr[grade].data[0][2] != "性别") {
                //删除文件
                fs.unlink("./" + files.studentExcel.path, function (err) {
                    if (err) {
                        console.log("删除文件错误");
                        return;
                    }
                    res.send("Excel文件的数据格式不正确，请检查后重新上传，表头应为“学号、姓名、性别”");
                });
                return;
            }

            for (var i = 1; i < stuArr[grade].data.length; i++) {
                // 数据库中学号以字符串类型储存，转为字符串后查重
                sidArr.push(stuArr[grade].data[i][0].toString());
            }
        }
        // console.log(sidArr);
        // 学号查重，另一种思路先去重然后比较长度，比如用set
        for (var j = 0; j < sidArr.length; j++) {
            for (var k = j + 1; k < sidArr.length; k++) {
                if (sidArr[j] == sidArr[k]) {
                    // console.log(j, k);
                    //删除文件
                    fs.unlink("./" + files.studentExcel.path, function (err) {
                        if (err) {
                            console.log("删除文件错误");
                            return;
                        }
                        res.send("学号有重复的项，请检查后重新上传");
                    });
                    return;
                }
            }
        }

        // 保存到数据库
        Student.saveToDB(stuArr);
        // console.log(arr, arr[0]);
        res.send("上传成功，返回学生列表即可查看")
    });
}
// 显示课程列表页面
exports.showCourse = (req, res) => {
    res.render("admin/course", { "current": "course" });
}
// 给前端提供课程列表的数据
exports.doShowCourse = (req, res) => {
    var form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
        // 从前端请求中拿到参数
        var rows = parseInt(fields.rows); //限制行数
        var page = fields.page; //当前页
        var sortobj = {};
        sortobj[fields.sidx] = fields.sord; //排序方式sidx jqGrid提交的排序字段

        // 删除：通过_id找到目标数据， jqGrid中将_id设置为主键，这样del操作提交的id就是数据库中的_id
        if (fields.oper === "del") {
            // 可能是多选，删除多条
            var idArr = fields.id.split(",");

            idArr.forEach((id) => {
                Course.deleteOne({ "_id": id }, (err, info) => {
                    if (err) {
                        res.send("删除失败");
                        return;
                    }
                    // 删除结果
                    console.log(info);
                })
            })
        }

        // 修改：通过_id找到目标，修改
        if (fields.oper === "edit") {
            // 检查课程编号是否重复
            Course.find({ "_id": fields.id }, (err, thisCou) => {

                Course.find({ "cid": fields.cid }, (err, results) => {
                    // 查找fields.cid如果为0或者cid不变说明学号不重复，否则学号重复，在学号单元格内提示
                    if (!(results.length === 0 || parseInt(fields.cid) === thisCou[0].cid)) {
                        // 编号重复就不改编号，其他项目照常修改
                        fields.cid = thisCou[0].cid;
                    res.send("-1");
                    return;
                    }

                    Course.updateOne({ "_id": fields.id }, { "cid": fields.cid, "name": fields.name, "time": fields.time, "number": fields.number, "permitGrade": fields.permitGrade, "teacher": fields.teacher, "introduction": fields.introduction }, { multi: true }, (err, info) => {
                        if (err) {
                            console.log(err);
                            return;
                        }
                        console.log(info);
                    })

                })
            })
        }

        // 增加
        if (fields.oper === "add") {
            // 检查学号是否重复
            Course.find({ "cid": fields.cid }, (err, results) => {
                // 课程编号重复或者漏填，补一个cid，值为最大cid +1
                if (results.length > 0 || fields.cid === "") {
                    // 寻找最大cid
                    Course.find({}, (err, results) => {
                        var maxId = results[0].cid;
                        results.forEach((item) => {
                            if (item.cid > maxId) {
                                maxId = item.cid;
                            }
                        })

                        fields.cid = maxId + 1;
                        // console.log(maxId);
                        
                        Course.create({ "cid": fields.cid, "name": fields.name, "time": fields.time, "number": fields.number, "permitGrade": fields.permitGrade, "teacher": fields.teacher, "introduction": fields.introduction }, (err, info) => {
                            if (err) {
                                console.log(err);
                                return;
                            }
                        });
                    });
                    return;
                }
              
                Course.create({ "cid": fields.cid, "name": fields.name, "time": fields.time, "number": fields.number, "permitGrade": fields.permitGrade, "teacher": fields.teacher, "introduction": fields.introduction }, (err, info) => {
                    if (err) {
                        console.log(err);
                        return;
                    }
                });
            })
        }

        // // 查询
        var searchObj = {};// 查询条件
        // if (fields._search === "true") {
        //     var searchField = fields.searchField;
        //     var searchString = fields.searchString;
        //     // 用正则做模糊查询，找含有searchString的文档
        //     var reg = new RegExp(searchString, "g");
        //     searchObj[searchField] = reg;
        // }

        Course.countDocuments(searchObj, function (err, count) {
            var totalpages = Math.ceil(count / rows); //总页数
            // 导出Excel
            // if (fields.oper === "download") {
            //     var TableR = [];
            //     var gradeArr = ["初一", "初二", "初三", "高一", "高二", "高三"];
            //     //迭代器！强行把异步函数变为同步的！当读取完毕初一的时候，才去读取初二……
            //     //i为0、1、2、3、4、5，表示读取初一、初二……高三的信息
            //     function iterator(i) {
            //         if (i == 6) {
            //             //此时TableR中已经是6个年级的大数组了！
            //             var buffer = xlsx.build(TableR);
            //             //生成文件
            //             var dateStr =format.asString("yyyy-MM-dd-hh-mm-ss.SSS", new Date());
            //             var filePath = "/download/学生名单" + dateStr + ".xlsx";
            //             fs.writeFile("./public"+ filePath, buffer, (err) => {
            //                 if(err) {
            //                     res.send("文件写入失败");
            //                 }
            //                 console.log("ok");

            //                 res.send(filePath);
            //             });
            //         }
            //         //整理数据
            //         Student.find({ "grade": gradeArr[i] }, (err, results) => {
            //             // sheetR子表，每个子表表示一个年级，先放一个表头
            //             var sheetR = [["学号", "姓名", "性别", "密码", "是初始密码？"]];
            //             results.forEach( (item) => {
            //                 // 每一列的数据，"学号", "姓名", "性别", "密码", "是初始密码？" 按照这个顺序推入数组
            //                 sheetR.push([
            //                     item.sid,
            //                     item.name,
            //                     item.sex,
            //                     item.password.pwd,
            //                     item.password.isInitial
            //                 ]);
            //             });
            //             // name年级，data对应年级的数据
            //             TableR.push({ "name": gradeArr[i], data: sheetR });

            //             iterator(++i);
            //         });
            //     }

            //     iterator(0);
            // } else {
            // 分页
            Course.find(searchObj).sort(sortobj).limit(rows).skip(rows * (page - 1)).exec((err, results) => {
                // 返回数据格式
                // console.log(results[0])
                res.json({
                    "totalpages": totalpages,
                    "currpage": page,
                    "totalrecords": count,
                    "rows": results,
                    "id": "cid",
                    "cell": ["cid", "name", "time", "number", "grade1", "grade2", "grade3", "grade4", "grade5", "grade6", "teacher", "introduction"]
                });
            });
            // }
        });
    });
}

// 显示导入课程页面
exports.showCourseImport = (req, res) => {
    res.render("admin/courseImport", { "current": "course" })
}

// 上传文件，导入课程
exports.doCourseImport = (req, res) => {
    var form = new formidable.IncomingForm();
    // 指定上传文件夹
    form.uploadDir = "./uploads";
    //保留文件后缀
    form.keepExtensions = true;
    form.parse(req, (err, fields, files) => {
        if (err) {
            res.send("上传失败，请重新上传");
        }
        // 检查文件，如果是空文件或者其他格式文件，提醒用户重新上传courseExcel，文件提交控件的name属性courseExcel
        // console.log(files.courseExcel.path);
        if (files.courseExcel.size === 0 || path.extname(files.courseExcel.path) != ".xlsx") {
            //删除文件
            fs.unlink("./" + files.courseExcel.path, function (err) {
                if (err) {
                    console.log("删除文件错误");
                    return;
                }
                res.send("文件无效，请重新上传");
            });
            return;
        }

        // 读取excel表格，parse转为数组，length表示子表格数量,课程列表的数据结构和学生名单相同
        var courseArr = xlsx.parse("./" + files.courseExcel.path);
        // 检查表格表头是否正确
        var cidArr = [];
        for (var c = 0; c < courseArr.length; c++) {
            // 检查表头关键字段
            if (courseArr[c].data[0][0] != "课程编号" || courseArr[c].data[0][1] != "课程名称" || courseArr[c].data[0][2] != "上课时间" || courseArr[c].data[0][3] != "可报人数" || courseArr[c].data[0][4] != "可报年级" || courseArr[c].data[0][4] != "可报年级") {
                //删除文件
                fs.unlink("./" + files.courseExcel.path, function (err) {
                    if (err) {
                        console.log("删除文件错误");
                        return;
                    }
                    res.send("Excel文件的表头格式不正确，请检查后重新上传");
                });
                return;
            }

            // 整理数据
            // 将可报年级转为数组，跳过表头
            for (var l = 1; l < courseArr[c].data.length; l++) {
                // 字符串转数组
                // console.log(courseArr[c].data[l][4].split("、"))
                var gradeArr = []
                gradeArr = courseArr[c].data[l][4].split("、")
                courseArr[c].data[l][4] = gradeArr;
            }
            // =1 跳过表头
            for (var i = 1; i < courseArr[c].data.length; i++) {
                // 转为字符串后查重
                cidArr.push(courseArr[c].data[i][0].toString());
            }
        }
        // console.log(courseArr[0].data)

        // 课程编号查重
        for (var j = 0; j < cidArr.length; j++) {
            for (var k = j + 1; k < cidArr.length; k++) {
                if (cidArr[j] == cidArr[k]) {
                    // console.log(j, k);
                    //删除文件
                    fs.unlink("./" + files.courseExcel.path, function (err) {
                        if (err) {
                            console.log("删除文件错误");
                            return;
                        }
                        res.send("课程编号有重复的项，请检查后重新上传");
                    });
                    return;
                }
            }
        }


        // 保存到数据库
        Course.saveToDB(courseArr);
        res.send("上传成功，返回课程列表即可查看")
    });
}

// 显示报表
exports.showCharts = (req, res) => {
    res.render("admin/charts", { "current": "charts" });
}
// 显示404页面
exports.show404 = (req, res) => {
    res.render("admin/404", { "current": "404" });
}
